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

variable "firebase_project_id" {
  description = "Firebase project whose ID tokens the API accepts"
  type        = string
  default     = "recall-ucu-edu"
}

variable "render_plan" {
  description = "Render instance plan. The provider documents paid plans (starter+); if it rejects \"free\", create the web service in the Render dashboard and keep only Neon here."
  type        = string
  default     = "free"
}
