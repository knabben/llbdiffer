IMAGE ?= llbdiffer

.PHONY: deps build dev lint typecheck test

# Reusable stage with node_modules installed; underlies dev/lint/typecheck/test.
deps:
	docker build --target deps -t $(IMAGE)-deps .

build:
	docker build -t $(IMAGE) .

dev: deps
	docker run --rm -it -p 3000:3000 -v $(CURDIR):/app -v /app/node_modules -w /app $(IMAGE)-deps npm run dev

lint: deps
	docker run --rm -v $(CURDIR):/app -v /app/node_modules -w /app $(IMAGE)-deps npm run lint

typecheck: deps
	docker run --rm -v $(CURDIR):/app -v /app/node_modules -w /app $(IMAGE)-deps npx tsc --noEmit

test: deps
	docker run --rm -v $(CURDIR):/app -v /app/node_modules -w /app $(IMAGE)-deps npm test
