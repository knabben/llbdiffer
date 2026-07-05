#!/usr/bin/env bash
# build-dag-capture.sh
#
# Captures BEFORE/AFTER build data for one Dockerfile edit, using only
# what buildx/BuildKit already emit. No custom instrumentation, no
# separate LLB-dumping tool — the planned DAG comes straight out of
# max-mode provenance, which the spec already requires capturing.
#
# Requires: docker buildx, jq. Also runs a local, throwaway registry
# container (attestations don't persist in the default local image
# store — see the comment near REGISTRY_NAME below).
#
# What this proves: the spec's "consume what BuildKit already emits"
# policy is real, not aspirational. What this does NOT do: match the
# spec's final node/edge schema exactly, sign anything, or sanitize
# secrets — those are the actual implementation work (see spec R3).

set -euo pipefail

# --- -1. Preflight: fail fast with remediation, not a bare "command not found" ---
missing=0
require() {
  local bin="$1" hint="$2"
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "MISSING: $bin"
    echo "  fix: $hint"
    missing=1
  fi
}

require docker         "install Docker with buildx (docker buildx version)"
require jq             "apt-get install jq / brew install jq"
require buildctl       "install BuildKit client (github.com/moby/buildkit releases)"
require dockerfile2llb "go build -o /usr/local/bin/dockerfile2llb ./examples/dockerfile2llb (from a buildkit checkout)"

if [ "$missing" -eq 1 ]; then
  echo
  echo "One or more required tools are missing. Fix the above, then re-run."
  echo "This check exists so failures show up here, not 100 lines into the script."
  exit 1
fi

# --- 0. Pin every axis that isn't the thing you're measuring ------------
# Replicability means: the ONLY difference between the before/after runs
# is the Dockerfile edit. Everything else below is fixed on purpose.

# Resolve this once per Alpine branch on your own build host, then
# hardcode it. Do NOT re-resolve automatically on every run — that
# reintroduces the exact drift this is meant to eliminate.
#   docker pull alpine:3.19 && docker inspect --format='{{index .RepoDigests 0}}' alpine:3.19
ALPINE_PIN="alpine:3.19@sha256:6baf43584bcb78f2e5847d1de515f23499913ac9f12bdf834811a3145eb11ca1"

# Same logic for packages: resolve exact versions once, pin them.
#   docker run --rm alpine:3.19 sh -c "apk update >/dev/null && apk policy curl git"
CURL_PIN="curl=8.14.1-r2"
GIT_PIN="git=2.43.7-r0"

# Pin the builder itself, not just the images it builds. LLB op shape
# and vertex metadata have changed across BuildKit releases — comparing
# dot dumps from two different BuildKit versions isn't a real diff.
BUILDKIT_IMAGE="moby/buildkit:v0.13.2"
BUILDER_NAME="dag-capture-pinned"

# network=host is not optional here: the docker-container driver runs
# buildkitd in its own network namespace. Without this, "localhost:5757"
# inside that container means the buildkit container's own loopback,
# not the host's — the push to the local registry below will hang or
# fail to connect, not because the registry is wrong, but because the
# builder can't see it.
#
# Idempotent by design, not by "check then create": `docker buildx
# inspect` succeeding only proves buildx's own metadata thinks the
# builder exists — it does NOT prove the underlying container is
# actually running. Those two can drift apart (a prior `buildx rm` that
# didn't fully complete, a container reaped by something else, etc.),
# and the earlier check-then-create version of this script trusted
# metadata over reality, which produced exactly that failure. `create`
# is allowed to fail here (builder already registered) — `--bootstrap`
# on inspect is what actually forces the container to exist, and heals
# the case where metadata and reality disagree.
docker buildx create --name "$BUILDER_NAME" \
  --driver docker-container \
  --driver-opt image="$BUILDKIT_IMAGE" \
  --driver-opt network=host >/dev/null 2>&1 || true
docker buildx inspect "$BUILDER_NAME" --bootstrap >/dev/null
docker buildx use "$BUILDER_NAME"

# Attestations (provenance, SBOM) do NOT persist in Docker's default
# local image store — VERIFIED against docs.docker.com: they only
# survive a push to an actual registry. --load will silently drop them.
# A local, throwaway registry is the smallest thing that satisfies that
# requirement without touching a real one.
REGISTRY_NAME="dag-capture-registry"
REGISTRY_PORT="5757"
# Same principle as the builder above: check whether the container is
# actually RUNNING, not just whether it exists — a stopped/exited
# container from a previous run would otherwise cause the exact same
# class of silent failure.
if [ "$(docker inspect -f '{{.State.Running}}' "$REGISTRY_NAME" 2>/dev/null)" != "true" ]; then
  docker rm -f "$REGISTRY_NAME" >/dev/null 2>&1 || true
  docker run -d --name "$REGISTRY_NAME" -p "${REGISTRY_PORT}:5000" registry:2 >/dev/null
fi
IMAGE_REF_BASE="localhost:${REGISTRY_PORT}/dag-capture"

WORKDIR=$(mktemp -d)
cd "$WORKDIR"
echo "Working in $WORKDIR"
echo "Builder: $BUILDER_NAME (BuildKit image: $BUILDKIT_IMAGE)"
echo "Registry: localhost:${REGISTRY_PORT} (local, throwaway — not a real distribution target)"

# --- 1. Example Dockerfile, version A (baseline) ----------------------
cat > Dockerfile.a <<EOF
FROM ${ALPINE_PIN} AS base
RUN apk add --no-cache ${CURL_PIN} ${GIT_PIN}
COPY app.sh /usr/local/bin/app.sh
RUN chmod +x /usr/local/bin/app.sh
CMD ["/usr/local/bin/app.sh"]
EOF

echo 'echo "hello from app"' > app.sh

# --- 2. Version B: a deliberate, realistic change ----------------------
# Reordered COPY before the package install — a classic cache-busting
# regression. This is the kind of thing the diff is meant to surface.
cat > Dockerfile.b <<EOF
FROM ${ALPINE_PIN} AS base
COPY app.sh /usr/local/bin/app.sh
RUN apk add --no-cache ${CURL_PIN} ${GIT_PIN}
RUN chmod +x /usr/local/bin/app.sh
CMD ["/usr/local/bin/app.sh"]
EOF

# --- 2c. Capture the planned LLB DAG as Graphviz dot (the real diff) ----
# This is the comparison that actually reflects cache behavior, so we do
# it FIRST — before the expensive builder/registry build below, and
# entirely offline (dockerfile2llb needs no daemon, no push).
#
# dockerfile2llb converts each Dockerfile to its LLB definition WITHOUT
# executing it; `buildctl debug dump-llb --dot` renders that as Graphviz.
#
# WHY NOT diff the raw sha256 vertex ids: BuildKit's dockerfile frontend
# stamps the local://context source op with a random per-run nonce
# ("local.unique"). That nonce changes the context vertex's digest every
# invocation, which cascades to every vertex DOWNSTREAM of it (copy, chmod,
# result). So a raw digest-set diff reports 4/6 vertices as "changed" even
# when nothing changed — it conflates the real edit with per-run noise, and
# it would make the replicability check at the bottom of this script fail.
#
# So we diff STRUCTURALLY instead: identify each vertex by its label plus
# the sorted labels of its inputs. Labels carry no nonce, so this is
# deterministic (same Dockerfile twice -> empty diff), and it still catches
# the reorder — moving COPY ahead of the package install changes which op
# feeds which, i.e. exactly these input sets. (Bare-sha256 terminal "result"
# labels are canonicalized to <result>, since that label is itself a
# nonce-bearing digest.)
capture_llb_dot () {
  local dockerfile="$1" outfile="$2"
  dockerfile2llb < "$dockerfile" | buildctl debug dump-llb --dot > "$outfile"
  echo "wrote $outfile"
}

# Emit one canonical key per vertex: "<label> <= [sorted input labels]".
structural_keys () {  # $1 = dot file
  local dot="$1"
  sed -nE 's/^\s*"(sha256:[0-9a-f]{64})" \[label="(.*)" shape=.*/\1\t\2/p' "$dot" \
    | sed -E 's/\t(sha256:[0-9a-f]{64})$/\t<result>/' > _nodes.tsv
  sed -nE 's/^\s*"(sha256:[0-9a-f]{64})" -> "(sha256:[0-9a-f]{64})".*/\1\t\2/p' "$dot" > _edges.tsv
  awk -F'\t' '
    FNR==NR { label[$1]=$2; next }
    { ins[$2] = ins[$2] "\x1f" label[$1] }
    END {
      for (d in label) {
        n=split(ins[d], a, "\x1f"); c=0; delete arr
        for(i=1;i<=n;i++) if(a[i]!="") arr[++c]=a[i]
        for(i=2;i<=c;i++){k=arr[i];j=i-1;while(j>0&&arr[j]>k){arr[j+1]=arr[j];j--}arr[j+1]=k}
        key=label[d] " <= ["; for(i=1;i<=c;i++) key=key (i>1?", ":"") arr[i]; key=key "]"
        print key
      }
    }
  ' _nodes.tsv _edges.tsv | sort
}

echo "== Capturing planned LLB DAGs as dot =="
capture_llb_dot Dockerfile.a llb-before.dot
capture_llb_dot Dockerfile.b llb-after.dot

echo "== LLB structural diff (before vs after) — the meaningful comparison =="
structural_keys llb-before.dot > llb-keys-before.txt
structural_keys llb-after.dot  > llb-keys-after.txt
echo "-- removed vertices (in before, not after) --"
comm -23 llb-keys-before.txt llb-keys-after.txt | sed 's/^/  /'
echo "-- added vertices (in after, not before) --"
comm -13 llb-keys-before.txt llb-keys-after.txt | sed 's/^/  /'
echo "-- unchanged vertices: $(comm -12 llb-keys-before.txt llb-keys-after.txt | wc -l | tr -d ' ') --"

# --- 2b. Deterministic cache state -------------------------------------
# Decide the cache policy explicitly instead of inheriting whatever is
# left over from a previous run. For a diff tool measuring cache-hit
# behavior, starting cold every time is the boring, correct default —
# a warm cache from an unrelated prior build is itself a source of
# false signal.
docker buildx prune -f --builder "$BUILDER_NAME" >/dev/null

# --- 3+4. Build with max-mode provenance, push, extract the LLB graph --
# --provenance=mode=max embeds the planned LLB graph as JSON, including
# each step's exec command args and its `inputs` (edges). This is the
# same data the dot dump would have given us, from an artifact the spec
# already requires capturing — no dockerfile2llb build, no buildctl.
# NOTE: BuildKit v0.13.2 emits SLSA v0.2 provenance, where the graph
# lives at .SLSA.buildConfig.llbDefinition (see reshape() below). The
# SLSA v1.0 path (.predicate.buildDefinition.internalParameters
# .buildConfig.llbDefinition) is a different, newer schema — if you bump
# BUILDKIT_IMAGE, re-check which one imagetools returns.
build_and_capture () {
  local dockerfile="$1" tag="$2" metafile="$3" logfile="$4" provfile="$5"
  docker buildx build \
    -f "$dockerfile" . \
    --provenance=mode=max \
    --metadata-file "$metafile" \
    --progress=plain \
    -t "${IMAGE_REF_BASE}:${tag}" \
    --push 2> "$logfile"

  docker buildx imagetools inspect "${IMAGE_REF_BASE}:${tag}" \
    --format '{{json .Provenance}}' > "$provfile"
}

echo "== Building version A (before) =="
build_and_capture Dockerfile.a before metadata-before.json build-before.log provenance-before.json

echo "== Building version B (after) =="
build_and_capture Dockerfile.b after metadata-after.json build-after.log provenance-after.json

# --progress=plain writes one line per vertex, including cache hits —
# this is literally the client.Solve status stream the spec references,
# just observed via CLI output instead of the Go API directly.
echo "== Vertex lines from the executed build (before) =="
grep -E '^#[0-9]+ ' build-before.log | head -20 || true

# --- 5. Reshape into the spec's node/edge schema (the actual adapter) ---
# Straight jq, no parsing needed — the provenance JSON already has id,
# op (command), and inputs (edges) per step. This also satisfies the
# spec's §4.1 requirement to carry the verbatim command string per node,
# for free: op.Op.exec.meta.args is exactly that.
reshape () {
  local provfile="$1" outfile="$2"
  jq '
    .SLSA.buildConfig.llbDefinition as $steps
    | {
        nodes: [$steps[] | {
          id: .id,
          command: (.op.Op.exec.meta.args // [] | join(" ")),
          metadata: { op: .op }
        }],
        edges: [$steps[] | .id as $dst | (.inputs // [])[] | {source: (split(":")[0]), target: $dst}]
      }
  ' "$provfile" > "$outfile"
  echo "wrote $outfile"
}

echo "== Reshaping provenance LLB definitions into node/edge JSON =="
reshape provenance-before.json dag-before.json
reshape provenance-after.json dag-after.json

# --- 6. Crude structural diff (jq stand-in for the real Go diff engine) -
echo "== Diffing node id sets (before vs after) =="
jq -r '.nodes[].id' dag-before.json | sort > ids-before.txt
jq -r '.nodes[].id' dag-after.json  | sort > ids-after.txt

echo "-- removed (in before, not after) --"
comm -23 ids-before.txt ids-after.txt

echo "-- added (in after, not before) --"
comm -13 ids-before.txt ids-after.txt

echo
# Record what produced this, so a future comparison against a DIFFERENT
# builder version is a conscious decision, not an accident discovered
# after the fact.
jq -n --arg builder "$BUILDER_NAME" --arg image "$BUILDKIT_IMAGE" \
  --arg base "$ALPINE_PIN" \
  '{builder: $builder, buildkitImage: $image, basePin: $base}' \
  > capture-environment.json

echo "Artifacts written to $WORKDIR:"
echo "  llb-before.dot / llb-after.dot         - planned LLB DAGs, content-addressed (THE comparison)"
echo "  llb-keys-before.txt / -after.txt       - structural vertex keys diffed above"
echo "  dag-before.json / dag-after.json       - reshaped node/edge graphs (from provenance)"
echo "  provenance-before.json / -after.json   - full mode=max provenance, unmodified"
echo "  metadata-before.json / -after.json     - buildx build metadata (image digest, etc.)"
echo "  build-before.log / -after.log          - raw vertex/cache stream"
echo "  capture-environment.json               - pinned builder/base versions used"
echo
echo "Known gaps vs. the spec (not solved by this script):"
echo "  - no GPG signing of any output"
echo "  - no secret/context sanitization of the provenance JSON (mode=max can include build-arg values)"
echo "  - the JSON dag diff is id-set only over positional ids (step0..stepN) and is effectively"
echo "    inert; the meaningful comparison is the LLB structural diff printed near the top"
echo "  - reshape adapter is BuildKit-provenance-specific; a real adapter needs to handle other sources too"
echo "  - registry container ($REGISTRY_NAME) is left running; docker rm -f $REGISTRY_NAME to clean up"
echo
echo "Replicability check before trusting any diff from this script:"
echo "  - ALPINE_PIN and package versions above MUST be resolved digests/versions, not placeholders"
echo "  - re-running this script twice with no Dockerfile change should produce an EMPTY diff"
echo "    (added/removed sets both blank) — if it isn't empty, something above is still unpinned"
echo "  - the LLB structural diff is deterministic by construction (it keys on op labels, not the"
echo "    nonce-bearing local://context digest); the raw dot digests themselves are NOT stable"
echo "    across runs, so diff llb-*.dot with 'sha256' masked if you compare files directly"
