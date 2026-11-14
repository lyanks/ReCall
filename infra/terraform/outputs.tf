output "app_url" {
  value = render_web_service.app.url
}

output "database_url" {
  value     = neon_project.db.connection_uri
  sensitive = true
}
