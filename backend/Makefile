.PHONY: build test run clean fmt lint

build:
	go build -o bin/server ./cmd/server

test:
	go test -v -coverprofile=coverage.out ./...

test-coverage:
	go test -v -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html

run:
	go run ./cmd/server

fmt:
	go fmt ./...

lint:
	golangci-lint run

clean:
	rm -rf bin/ coverage.out coverage.html

install-tools:
	go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
