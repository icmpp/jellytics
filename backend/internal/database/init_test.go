package database

import (
	"strings"
	"testing"
)

func TestSplitStatementsTriggers(t *testing.T) {
	sql := `CREATE TRIGGER IF NOT EXISTS update_show_stats_on_episode_watch
AFTER UPDATE OF watched ON episodes
BEGIN
    UPDATE shows SET
        watched_episodes = (SELECT 1),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.show_id;
END;
`
	statements := splitStatements(sql)
	if len(statements) != 1 {
		t.Fatalf("expected 1 statement, got %d", len(statements))
	}
	stmt := statements[0]
	if !strings.Contains(stmt, "BEGIN") {
		t.Error("statement should contain BEGIN")
	}
	if !strings.Contains(stmt, "END;") {
		t.Error("statement should contain END;")
	}
	if !strings.Contains(stmt, "WHERE id = NEW.show_id") {
		t.Error("statement should contain full UPDATE")
	}
}
