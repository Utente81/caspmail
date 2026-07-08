const jwt = require("jsonwebtoken");
console.log(jwt.sign({email: "admin@acme.com", roles: ["admin", "soc_admin"]}, "supersecretcasperkey2026!"));
