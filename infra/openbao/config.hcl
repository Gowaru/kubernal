listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = true
}

storage "file" {
  path = "/bao/file"
}

api_addr = "http://localhost:8200"
