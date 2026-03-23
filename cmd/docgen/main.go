package main

import (
	"encoding/json"
	"log"
	"os"

	"github.com/xkamail/godoclive/pkg/godoclive"
)

func main() {
	endpoints, err := godoclive.Analyze(".", "./...")
	if err != nil {
		log.Fatal(err)
	}
	out, err := json.Marshal(endpoints)
	if err != nil {
		log.Fatal(err)
	}
	if err := os.WriteFile("docs.json", out, 0644); err != nil {
		log.Fatal(err)
	}
	log.Printf("generated docs.json with %d endpoints", len(endpoints))
}
