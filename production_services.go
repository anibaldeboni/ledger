package main

import (
	"errors"
	"time"

	"ledger/internal/domain"
)

func (s *LedgerService) ListProductionColumns() ([]domain.ProductionColumn, error) {
	return s.store.ListProductionColumns()
}

func (s *LedgerService) SaveProductionColumn(column domain.ProductionColumn) (domain.ProductionColumn, error) {
	err := s.store.SaveProductionColumn(&column)
	return column, err
}

func (s *LedgerService) ReorderProductionColumns(ids []int64) error {
	return s.store.ReorderProductionColumns(ids)
}

func (s *LedgerService) DeleteProductionColumn(id int64) error {
	return s.store.DeleteProductionColumn(id)
}

func (s *LedgerService) CreateProductionOrder(title string) (domain.ProductionOrder, error) {
	return s.store.CreateProductionOrder(title)
}

func (s *LedgerService) UpdateProductionOrderTitle(id int64, title string) error {
	return s.store.UpdateProductionOrderTitle(id, title)
}

func (s *LedgerService) ListProductionOrders() ([]domain.ProductionOrder, error) {
	return s.store.ListProductionOrders()
}

func (s *LedgerService) ListArchivedProductionOrders() ([]domain.ProductionOrder, error) {
	return s.store.ListArchivedProductionOrders()
}

func (s *LedgerService) AddProductionTicket(orderID, quoteID int64) (domain.ProductionTicket, error) {
	return s.store.AddProductionTicket(orderID, quoteID)
}

func (s *LedgerService) MoveProductionTicket(ticketID, columnID int64) error {
	return s.store.MoveProductionTicket(ticketID, columnID)
}

func (s *LedgerService) DeleteProductionOrder(id int64) error {
	return s.store.DeleteProductionOrder(id)
}

func (s *LedgerService) CompleteProductionOrder(id int64) error {
	return s.store.CompleteProductionOrder(id)
}

func (s *LedgerService) ArchiveProductionOrder(id int64) error {
	return s.store.ArchiveProductionOrder(id)
}

func (s *LedgerService) GenerateProductionReport(startAt, endAt string) (domain.ProductionReport, error) {
	start, err := time.Parse(time.RFC3339, startAt)
	if err != nil {
		return domain.ProductionReport{}, errors.New("A data inicial do relatório é inválida.")
	}
	end, err := time.Parse(time.RFC3339, endAt)
	if err != nil {
		return domain.ProductionReport{}, errors.New("A data final do relatório é inválida.")
	}
	if !start.Before(end) {
		return domain.ProductionReport{}, errors.New("O período do relatório deve ter início anterior ao fim.")
	}
	return s.store.GenerateProductionReport(start.UTC().Format(time.RFC3339), end.UTC().Format(time.RFC3339))
}
