package site

import (
	"context"
)

type Role struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

var roles = []Role{
	{ID: "*", Name: "Owner", Description: "Full access to all site settings and members"},
	{ID: "editor", Name: "Editor", Description: "Can manage devices, chargers, and view data"},
	{ID: "viewer", Name: "Viewer", Description: "Read-only access to site data"},
}

type ListRolesResult struct {
	Items []Role `json:"items"`
}

func ListRoles(_ context.Context, _ *struct{}) (*ListRolesResult, error) {
	return &ListRolesResult{Items: roles}, nil
}
