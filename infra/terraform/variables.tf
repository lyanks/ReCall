variable "app_name" {
  type    = string
  default = "recall"
}

variable "repo_url" {
  description = "HTTPS URL of the GitHub repository"
  type        = string
}

variable "branch" {
  type    = string
  default = "main"
}

variable "firebase" {
  description = "Firebase web config (public values) + project id for token checks"
  type = object({
    api_key     = string
    auth_domain = string
    project_id  = string
    app_id      = string
  })
}

variable "render_plan" {
  description = "Render instance plan. The provider documents paid plans (starter+); if it rejects \"free\", create the web service in the Render dashboard and keep only Neon here."
  type        = string
  default     = "free"
}
