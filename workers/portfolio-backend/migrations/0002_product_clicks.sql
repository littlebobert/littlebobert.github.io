CREATE TABLE IF NOT EXISTS product_clicks (
  product TEXT NOT NULL,
  action TEXT NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  first_clicked_at TEXT NOT NULL,
  last_clicked_at TEXT NOT NULL,
  PRIMARY KEY (product, action)
);
