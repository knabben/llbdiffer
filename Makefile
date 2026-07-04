IMAGE ?= llbdiffer

.PHONY: deps build dev lint test

# Reusable stage with node_modules installed; underlies dev/lint/test.
deps:
	docker build --target deps -t $(IMAGE)-deps .

build:
	docker build -t $(IMAGE) .

dev: deps
	docker run --rm -it -p 3000:3000 -v $(CURDIR):/app -w /app $(IMAGE)-deps npm run dev

lint: deps
	docker run --rm -v $(CURDIR):/app -w /app $(IMAGE)-deps npm run lint

test: deps
	docker run --rm -v $(CURDIR):/app -w /app $(IMAGE)-deps npm test
