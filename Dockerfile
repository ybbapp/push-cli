# syntax=docker/dockerfile:1
FROM --platform=$BUILDPLATFORM golang:1.26-alpine AS build

ARG TARGETARCH
ARG VERSION=dev

WORKDIR /src
RUN apk add --no-cache ca-certificates
COPY go.mod ./
COPY cmd ./cmd
RUN CGO_ENABLED=0 GOOS=linux GOARCH=${TARGETARCH} go build -trimpath \
    -ldflags "-s -w -X main.version=${VERSION}" \
    -o /out/push-cli ./cmd

FROM scratch
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=build /out/push-cli /usr/local/bin/push-cli
USER 65532:65532
ENTRYPOINT ["/usr/local/bin/push-cli"]
