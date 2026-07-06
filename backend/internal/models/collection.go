package models

// Collection is a user-defined grouping of media.
type Collection struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	ItemCount   int    `json:"itemCount"`
	CreatedAt   string `json:"createdAt"`
}

// CollectionItem is a single movie/show entry within a collection.
type CollectionItem struct {
	ItemType  string `json:"itemType"`
	ItemID    int    `json:"itemId"`
	Title     string `json:"title,omitempty"`
	PosterURL string `json:"posterUrl,omitempty"`
}

// CollectionWithItems is a collection plus its resolved items.
type CollectionWithItems struct {
	Collection
	Items []CollectionItem `json:"items"`
}

// CollectionListItem is a collection in a list, optionally flagged with whether
// it already contains a queried item.
type CollectionListItem struct {
	Collection
	HasItem bool `json:"hasItem,omitempty"`
}
