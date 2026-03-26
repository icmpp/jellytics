import { format } from "date-fns";
import { formatRuntime } from "@/lib/utils";

interface YearInReviewForExport {
  year: number;
  total_watch_minutes: number;
  episodes_watched: number;
  movies_watched: number;
  top_movies: Array<{ title: string; total_watch_time_minutes: number }>;
  top_shows: Array<{ title: string; total_watch_time_minutes: number }>;
  top_genres: Record<string, number>;
  month_by_month: Array<{
    month: string;
    total_watch_minutes: number;
    episodes_watched: number;
  }>;
}

export function exportToExcel(data: any[], filename: string) {
  if (!data || data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          if (value === null || value === undefined) return "";
          const stringValue = String(value);
          if (
            stringValue.includes(",") ||
            stringValue.includes('"') ||
            stringValue.includes("\n")
          ) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        })
        .join(","),
    ),
  ];

  const csv = csvRows.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportStatsToPDF(
  overview: any,
  trends: any[],
  genres: any,
  filename: string = "jellyfin-stats",
) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const currentDate = format(new Date(), "MMMM d, yyyy");
  const currentTime = format(new Date(), "h:mm a");

  const trendsRows =
    trends && Array.isArray(trends)
      ? trends
          .slice(-14)
          .map(
            (item: any) => `
        <tr>
          <td>${format(new Date(item.snapshot_date), "MMM d, yyyy")}</td>
          <td>${Math.round(item.total_watch_time_minutes / 60)}h</td>
          <td>${item.shows_watched || 0}</td>
          <td>${item.episodes_watched || 0}</td>
        </tr>
      `,
          )
          .join("")
      : "";

  const genresRows =
    genres && typeof genres === "object"
      ? Object.entries(genres)
          .sort((a, b) => (b[1] as number) - (a[1] as number))
          .slice(0, 10)
          .map(
            ([genre, count]) => `
          <tr>
            <td>${genre}</td>
            <td>${count}</td>
          </tr>
        `,
          )
          .join("")
      : "";

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${filename}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
            padding: 40px;
            color: #1a1a2e;
            background: #fff;
            line-height: 1.5;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 2px solid #7c3aed;
          }
          .header h1 {
            font-size: 28px;
            font-weight: 700;
            color: #7c3aed;
            margin-bottom: 4px;
          }
          .header .subtitle {
            color: #666;
            font-size: 14px;
          }
          .header .date {
            text-align: right;
            color: #666;
            font-size: 13px;
          }
          .section {
            margin-bottom: 32px;
          }
          .section-title {
            font-size: 16px;
            font-weight: 600;
            color: #1a1a2e;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .section-title::before {
            content: '';
            width: 4px;
            height: 20px;
            background: #7c3aed;
            border-radius: 2px;
          }
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
            margin-bottom: 32px;
          }
          .stat-card {
            background: #f8f7ff;
            border: 1px solid #e9e4ff;
            border-radius: 12px;
            padding: 20px;
          }
          .stat-card .label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
          }
          .stat-card .value {
            font-size: 28px;
            font-weight: 700;
            color: #7c3aed;
          }
          .stat-card .value .unit {
            font-size: 14px;
            font-weight: 400;
            color: #999;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
          }
          th {
            background: #7c3aed;
            color: #fff;
            padding: 12px 16px;
            text-align: left;
            font-weight: 600;
          }
          th:first-child {
            border-radius: 8px 0 0 0;
          }
          th:last-child {
            border-radius: 0 8px 0 0;
          }
          td {
            padding: 12px 16px;
            border-bottom: 1px solid #eee;
          }
          tr:nth-child(even) {
            background: #fafafa;
          }
          tr:last-child td:first-child {
            border-radius: 0 0 0 8px;
          }
          tr:last-child td:last-child {
            border-radius: 0 0 8px 0;
          }
          .two-col {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 32px;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            text-align: center;
            color: #999;
            font-size: 12px;
          }
          @media print {
            body { padding: 20px; }
            .stats-grid { grid-template-columns: repeat(4, 1fr); }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>Jellytics Statistics Report</h1>
            <p class="subtitle">Viewing analytics and insights</p>
          </div>
          <div class="date">
            <div>${currentDate}</div>
            <div>${currentTime}</div>
          </div>
        </div>

        <div class="section">
          <h2 class="section-title">Overview</h2>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="label">Total Watch Time</div>
              <div class="value">${overview ? Math.round(overview.total_watch_time_minutes / 60) : 0} <span class="unit">hours</span></div>
            </div>
            <div class="stat-card">
              <div class="label">Total Items</div>
              <div class="value">${overview?.total_shows || 0}</div>
            </div>
            <div class="stat-card">
              <div class="label">Watched</div>
              <div class="value">${overview?.shows_watched || 0}</div>
            </div>
            <div class="stat-card">
              <div class="label">Currently Watching</div>
              <div class="value">${overview?.shows_watching || 0}</div>
            </div>
          </div>
        </div>

        <div class="two-col">
          <div class="section">
            <h2 class="section-title">Recent Trends</h2>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Watch Time</th>
                  <th>Shows</th>
                  <th>Episodes</th>
                </tr>
              </thead>
              <tbody>
                ${trendsRows || '<tr><td colspan="4" style="text-align: center; color: #999;">No data available</td></tr>'}
              </tbody>
            </table>
          </div>

          <div class="section">
            <h2 class="section-title">Top Genres</h2>
            <table>
              <thead>
                <tr>
                  <th>Genre</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                ${genresRows || '<tr><td colspan="2" style="text-align: center; color: #999;">No data available</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>

        <div class="footer">
          Generated by Jellytics • ${currentDate}
        </div>
      </body>
    </html>
  `);

  printWindow.document.close();

  setTimeout(() => {
    printWindow.print();
  }, 300);
}

export function exportStatsToExcel(
  overview: any,
  trends: any[],
  genres: any,
  filename: string = `jellyfin-stats-${format(new Date(), "yyyy-MM-dd")}`,
  ratings?: Array<{ item_type: string; item_id: number; rating: number; rated_at: string }>,
  reviews?: Array<{ item_type: string; item_id: number; review_text: string; notes?: string; updated_at: string }>,
) {
  const sheets: { name: string; data: any[] }[] = [];

  if (overview) {
    sheets.push({
      name: "Overview",
      data: [
        {
          Metric: "Total Watch Time (hours)",
          Value: Math.round(overview.total_watch_time_minutes / 60),
        },
        { Metric: "Total Items", Value: overview.total_shows || 0 },
        { Metric: "Watched", Value: overview.shows_watched || 0 },
        { Metric: "Currently Watching", Value: overview.shows_watching || 0 },
        { Metric: "Pending", Value: overview.shows_pending || 0 },
        { Metric: "Episodes Watched", Value: overview.episodes_watched || 0 },
      ],
    });
  }

  if (trends && Array.isArray(trends)) {
    sheets.push({
      name: "Trends",
      data: trends.map((item: any) => ({
        Date: format(new Date(item.snapshot_date), "yyyy-MM-dd"),
        "Watch Time (hours)": Math.round(item.total_watch_time_minutes / 60),
        "Shows Watched": item.shows_watched || 0,
        "Shows Watching": item.shows_watching || 0,
        "Episodes Watched": item.episodes_watched || 0,
      })),
    });
  }

  if (genres && typeof genres === "object") {
    sheets.push({
      name: "Genres",
      data: Object.entries(genres)
        .map(([genre, count]) => ({ Genre: genre, Count: count }))
        .sort((a, b) => (b.Count as number) - (a.Count as number)),
    });
  }

  if (ratings && ratings.length > 0) {
    sheets.push({
      name: "Ratings",
      data: ratings.map((r) => ({
        "Item Type": r.item_type,
        "Item ID": r.item_id,
        Rating: r.rating,
        "Rated At": r.rated_at,
      })),
    });
  }

  if (reviews && reviews.length > 0) {
    sheets.push({
      name: "Reviews",
      data: reviews.map((r) => ({
        "Item Type": r.item_type,
        "Item ID": r.item_id,
        "Review": r.review_text,
        Notes: r.notes ?? "",
        "Updated At": r.updated_at,
      })),
    });
  }

  if (sheets.length > 0) {
    const allData = sheets.flatMap((sheet) => [
      { "": `=== ${sheet.name} ===`, "": "", "": "", "": "", "": "" },
      ...sheet.data,
      { "": "", "": "", "": "", "": "", "": "" },
    ]);

    exportToExcel(allData, filename);
  }
}

export function exportYearInReviewToPDF(
  data: YearInReviewForExport,
  filename: string = "year-in-review",
) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const topGenresRows =
    data.top_genres && Object.keys(data.top_genres).length > 0
      ? Object.entries(data.top_genres)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(
            ([g, c]) =>
              `<tr><td>${g}</td><td>${c}</td></tr>`,
          )
          .join("")
      : "";

  const topMoviesRows =
    data.top_movies && data.top_movies.length > 0
      ? data.top_movies
          .map(
            (m) =>
              `<tr><td>${m.title}</td><td>${formatRuntime(m.total_watch_time_minutes) ?? "0m"}</td></tr>`,
          )
          .join("")
      : "";

  const topShowsRows =
    data.top_shows && data.top_shows.length > 0
      ? data.top_shows
          .map(
            (s) =>
              `<tr><td>${s.title}</td><td>${formatRuntime(s.total_watch_time_minutes) ?? "0m"}</td></tr>`,
          )
          .join("")
      : "";

  const monthRows =
    data.month_by_month && data.month_by_month.length > 0
      ? data.month_by_month
          .map(
            (r) =>
              `<tr><td>${format(new Date(r.month + "-01"), "MMMM yyyy")}</td><td>${formatRuntime(r.total_watch_minutes) ?? "0m"}</td><td>${r.episodes_watched}</td></tr>`,
          )
          .join("")
      : "";

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${data.year} Year in Review</title>
        <style>
          body { font-family: -apple-system, sans-serif; padding: 40px; color: #1a1a2e; }
          h1 { color: #7c3aed; margin-bottom: 8px; }
          h2 { font-size: 16px; margin: 24px 0 12px; color: #333; }
          .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 20px 0; }
          .stat { background: #f8f7ff; padding: 16px; border-radius: 8px; }
          .stat .label { font-size: 12px; color: #666; }
          .stat .value { font-size: 24px; font-weight: 700; color: #7c3aed; }
          table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
          th { background: #7c3aed; color: #fff; padding: 10px; text-align: left; }
          td { padding: 10px; border-bottom: 1px solid #eee; }
          .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        </style>
      </head>
      <body>
        <h1>${data.year} Year in Review</h1>
        <p style="color:#666; margin-bottom: 24px;">Generated by Jellytics • ${format(new Date(), "PPP")}</p>

        <div class="stats">
          <div class="stat"><div class="label">Watch Time</div><div class="value">${formatRuntime(data.total_watch_minutes) ?? "0m"}</div></div>
          <div class="stat"><div class="label">Episodes</div><div class="value">${data.episodes_watched}</div></div>
          <div class="stat"><div class="label">Movies</div><div class="value">${data.movies_watched}</div></div>
          <div class="stat"><div class="label">Top Genre</div><div class="value">${data.top_genres && Object.keys(data.top_genres).length > 0 ? Object.entries(data.top_genres).sort((a, b) => b[1] - a[1])[0][0] : "—"}</div></div>
        </div>

        <div class="two-col">
          <div>
            <h2>Top Movies</h2>
            <table><thead><tr><th>Title</th><th>Watch Time</th></tr></thead><tbody>${topMoviesRows || "<tr><td colspan='2'>No data</td></tr>"}</tbody></table>
          </div>
          <div>
            <h2>Top Shows</h2>
            <table><thead><tr><th>Title</th><th>Watch Time</th></tr></thead><tbody>${topShowsRows || "<tr><td colspan='2'>No data</td></tr>"}</tbody></table>
          </div>
        </div>

        <h2>Top Genres</h2>
        <table><thead><tr><th>Genre</th><th>Count</th></tr></thead><tbody>${topGenresRows || "<tr><td colspan='2'>No data</td></tr>"}</tbody></table>

        <h2>Month by Month</h2>
        <table><thead><tr><th>Month</th><th>Watch Time</th><th>Episodes</th></tr></thead><tbody>${monthRows || "<tr><td colspan='3'>No data</td></tr>"}</tbody></table>
      </body>
    </html>
  `);

  printWindow.document.close();
  setTimeout(() => printWindow.print(), 300);
}
