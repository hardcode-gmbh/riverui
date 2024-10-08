package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"github.com/rs/cors"
	sloghttp "github.com/samber/slog-http"

	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"
	"github.com/riverqueue/riverui"
)

var logger *slog.Logger //nolint:gochecknoglobals

func main() {
	ctx := context.Background()
	if err := godotenv.Load(); err != nil {
		fmt.Printf("No .env file detected, using environment variables\n")
	}

	if os.Getenv("RIVER_DEBUG") == "1" || os.Getenv("RIVER_DEBUG") == "true" {
		logger = slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelDebug}))
	} else {
		logger = slog.New(slog.NewTextHandler(os.Stdout, nil))
	}

	os.Exit(initAndServe(ctx))
}

func initAndServe(ctx context.Context) int {
	var pathPrefix string
	flag.StringVar(&pathPrefix, "prefix", "/", "path prefix to use for the API and UI HTTP requests")
	flag.Parse()

	if !strings.HasPrefix(pathPrefix, "/") || pathPrefix == "" {
		logger.ErrorContext(ctx, "invalid path prefix", slog.String("prefix", pathPrefix))
		return 1
	}
	pathPrefix = normalizePathPrefix(pathPrefix)

	corsOriginString := os.Getenv("CORS_ORIGINS")
	corsOrigins := strings.Split(corsOriginString, ",")
	dbURL := mustEnv("DATABASE_URL")
	otelEnabled := os.Getenv("OTEL_ENABLED") == "true"
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dbPool, err := getDBPool(ctx, dbURL)
	if err != nil {
		logger.ErrorContext(ctx, "error connecting to db", slog.String("error", err.Error()))
		return 1
	}
	defer dbPool.Close()

	corsHandler := cors.New(cors.Options{
		AllowedMethods: []string{"GET", "HEAD", "POST", "PUT"},
		AllowedOrigins: corsOrigins,
	})

	client, err := river.NewClient(riverpgxv5.New(dbPool), &river.Config{})
	if err != nil {
		logger.ErrorContext(ctx, "error creating river client", slog.String("error", err.Error()))
		return 1
	}

	handlerOpts := &riverui.HandlerOpts{
		Client:            client,
		DBPool:            dbPool,
		Logger:            logger,
		Prefix:            pathPrefix,
		BasicAuthUser:     os.Getenv("BASIC_AUTH_USER"),
		BasicAuthPassword: os.Getenv("BASIC_AUTH_PASSWORD"),
	}

	server, err := riverui.NewServer(handlerOpts)
	if err != nil {
		logger.ErrorContext(ctx, "error creating handler", slog.String("error", err.Error()))
		return 1
	}

	if err := server.Start(ctx); err != nil {
		logger.ErrorContext(ctx, "error starting UI server", slog.String("error", err.Error()))
		return 1
	}

	logHandler := sloghttp.Recovery(server.Handler())
	config := sloghttp.Config{
		WithSpanID:  otelEnabled,
		WithTraceID: otelEnabled,
	}
	wrappedHandler := sloghttp.NewWithConfig(logger, config)(corsHandler.Handler(logHandler))

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           wrappedHandler,
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("starting server on %s", srv.Addr)

	if err = srv.ListenAndServe(); err != nil && errors.Is(err, http.ErrServerClosed) {
		logger.ErrorContext(ctx, "error from ListenAndServe", slog.String("error", err.Error()))
		return 1
	}

	return 0
}

func getDBPool(ctx context.Context, dbURL string) (*pgxpool.Pool, error) {
	poolConfig, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		return nil, fmt.Errorf("error parsing db config: %w", err)
	}

	dbPool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("error connecting to db: %w", err)
	}
	return dbPool, nil
}

func mustEnv(name string) string {
	val := os.Getenv(name)
	if val == "" {
		logger.Error("missing required env var", slog.String("name", name))
		os.Exit(1)
	}
	return val
}

func normalizePathPrefix(prefix string) string {
	if prefix == "" {
		return "/"
	}
	prefix = strings.TrimSuffix(prefix, "/")
	if !strings.HasPrefix(prefix, "/") {
		return "/" + prefix
	}
	return prefix
}
