package main

import (
	"embed"
	"log"

	"github.com/adrg/xdg"
	"github.com/wailsapp/wails/v3/pkg/application"

	"ledger/internal/store"
)

// Wails usa o `embed` do Go para embutir os arquivos do frontend no binário.
//
//go:embed all:frontend/dist
var assets embed.FS

func main() {
	dbPath, err := xdg.DataFile("ledger/ledger.db")
	if err != nil {
		log.Fatal(err)
	}
	st, err := store.Open(dbPath)
	if err != nil {
		log.Fatal(err)
	}
	defer st.Close()

	app := application.New(application.Options{
		Name:        "ledger",
		Description: "Orçamentos de impressão 3D",
		Services: []application.Service{
			application.NewService(&LedgerService{store: st}),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:            "Ledger · Orçamentos 3D",
		Width:            1120,
		Height:           720,
		MinWidth:         900,
		MinHeight:        600,
		BackgroundColour: application.NewRGB(6, 7, 15),
		URL:              "/",
	})

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
