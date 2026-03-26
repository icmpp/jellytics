// Package logger configures zerolog for structured logging with configurable level and format.
package logger

import (
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func Init(level, format string) {
	logLevel, err := zerolog.ParseLevel(level)
	if err != nil {
		logLevel = zerolog.InfoLevel
	}
	zerolog.SetGlobalLevel(logLevel)

	if format == "console" {
		output := newConsoleWriter(os.Stdout)
		log.Logger = zerolog.New(output).With().Timestamp().Logger()
	} else {
		log.Logger = zerolog.New(os.Stdout).With().Timestamp().Logger()
	}

	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
}

func newConsoleWriter(out io.Writer) zerolog.ConsoleWriter {
	return zerolog.ConsoleWriter{
		Out:        out,
		TimeFormat: "15:04:05",
		PartsOrder: []string{
			zerolog.TimestampFieldName,
			zerolog.LevelFieldName,
			zerolog.MessageFieldName,
		},
		FormatLevel: func(i interface{}) string {
			level := strings.ToLower(fmt.Sprintf("%v", i))
			switch level {
			case "trace":
				return colorize("TRC", 246)
			case "debug":
				return colorize("DBG", 246)
			case "info":
				return colorize("INF", 34)
			case "warn", "warning":
				return colorize("WRN", 214)
			case "error":
				return colorize("ERR", 196)
			case "fatal":
				return colorize("FTL", 196)
			case "panic":
				return colorize("PNC", 196)
			default:
				return colorize(level, 246)
			}
		},
		FormatMessage: func(i interface{}) string {
			if msg, ok := i.(string); ok && msg != "" {
				return " " + msg
			}
			return ""
		},
		FormatFieldName: func(i interface{}) string {
			return colorize(fmt.Sprintf(" %s=", i), 246)
		},
		FormatFieldValue: func(i interface{}) string {
			return fmt.Sprintf("%v", i)
		},
	}
}

func colorize(s string, color int) string {
	if color == 0 {
		return s
	}
	return fmt.Sprintf("\x1b[%dm%s\x1b[0m", color, s)
}
