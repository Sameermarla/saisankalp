import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.*;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.text.SimpleDateFormat;
import java.util.Base64;
import java.util.Date;
import java.util.List;
import java.util.Properties;
import java.util.UUID;
import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;

public class Server {

    private static final int PORT = 8080;
    private static final String STATIC_DIR = ".";
    private static final String CONFIG_FILE = "config.properties";
    private static final String DATA_DIR = "data";
    private static final String CSV_DB = DATA_DIR + "/orders.csv";
    private static final String JSON_DB = DATA_DIR + "/orders.json";
    
    // Configured SMTP properties
    private static Properties config = new Properties();

    static class PaymentInfo {
        String transactionId;
        String status; // "pending", "success", "failed", "cancelled"
        double amount;
        long timestamp;
        boolean used;

        PaymentInfo(String transactionId, double amount) {
            this.transactionId = transactionId;
            this.status = "pending";
            this.amount = amount;
            this.timestamp = System.currentTimeMillis();
            this.used = false;
        }
    }

    static class SessionInfo {
        String email;
        String role;
        long expires;

        SessionInfo(String email, String role, long expires) {
            this.email = email;
            this.role = role;
            this.expires = expires;
        }
    }

    static class OtpInfo {
        String code;
        String passwordHash;
        long expires;
        boolean reset;

        OtpInfo(String code, String passwordHash, long expires, boolean reset) {
            this.code = code;
            this.passwordHash = passwordHash;
            this.expires = expires;
            this.reset = reset;
        }
    }

    private static final java.util.Map<String, PaymentInfo> PAYMENTS = new java.util.concurrent.ConcurrentHashMap<>();
    private static final java.util.Map<String, PaymentInfo> TEST_PAYMENTS = new java.util.concurrent.ConcurrentHashMap<>();
    private static final java.util.Map<String, SessionInfo> SESSIONS = new java.util.concurrent.ConcurrentHashMap<>();
    private static final java.util.Map<String, OtpInfo> OTPS = new java.util.concurrent.ConcurrentHashMap<>();
    private static final java.util.Map<String, java.util.List<Long>> RATE_LIMITS = new java.util.concurrent.ConcurrentHashMap<>();

    public static void main(String[] args) {
        // 1. Load Configurations
        loadConfig();

        // 2. Ensure Database Folder and Files exist
        ensureDatabaseExists();

        try {
            // 3. Create HttpServer instance
            HttpServer server = HttpServer.create(new InetSocketAddress(PORT), 0);
            
            // Context for static files (HTML, CSS, JS, Images)
            server.createContext("/", new StaticFileHandler());
            
            // Context for Products REST API
            server.createContext("/api/products", new ProductsApiHandler());

            // Context for Orders REST API (POST order data)
            server.createContext("/api/orders", new OrdersApiHandler());
            
            // Context for Payment API
            server.createContext("/api/payments/initiate", new PaymentsInitiateHandler());
            server.createContext("/api/payments/status", new PaymentsStatusHandler());
            server.createContext("/api/payments/webhook", new PaymentsWebhookHandler());
            
            // Context for Order Management API
            server.createContext("/api/orders/update-status", new OrdersUpdateStatusHandler());
            server.createContext("/api/orders/resend-email", new OrdersResendEmailHandler());

            // Context for Authentication API
            server.createContext("/api/auth/register", new AuthRegisterHandler());
            server.createContext("/api/auth/verify-otp", new AuthVerifyOtpHandler());
            server.createContext("/api/auth/login", new AuthLoginHandler());
            server.createContext("/api/auth/forgot-password", new AuthForgotPasswordHandler());
            server.createContext("/api/auth/reset-password", new AuthResetPasswordHandler());
            
            server.setExecutor(null); // Use default executor
            
            System.out.println("==================================================");
            System.out.println("  Sai Sankalp Backend Server is Starting... ");
            System.out.println("  Serving files from: " + new File(STATIC_DIR).getAbsolutePath());
            System.out.println("  Database locations: ");
            System.out.println("     - CSV (Excel): " + new File(CSV_DB).getAbsolutePath());
            System.out.println("     - JSON:        " + new File(JSON_DB).getAbsolutePath());
            System.out.println("  Local URL: http://localhost:" + PORT);
            System.out.println("  Press Ctrl+C to stop the server.");
            System.out.println("==================================================");
            
            server.start();
            
        } catch (IOException e) {
            System.err.println("Failed to start the server: " + e.getMessage());
            e.printStackTrace();
        }
    }

    /**
     * Load configuration properties
     */
    private static void loadConfig() {
        File configFile = new File(CONFIG_FILE);
        if (configFile.exists()) {
            try (InputStream input = new FileInputStream(configFile)) {
                config.load(input);
                System.out.println("Configurations loaded successfully from config.properties");
            } catch (IOException ex) {
                System.err.println("Warning: Could not load config.properties: " + ex.getMessage());
            }
        } else {
            System.out.println("Note: config.properties not found. Creating default template.");
            try (OutputStream output = new FileOutputStream(configFile)) {
                Properties defaultProps = new Properties();
                defaultProps.setProperty("smtp.host", "smtp.gmail.com");
                defaultProps.setProperty("smtp.port", "587");
                defaultProps.setProperty("sender.email", "your-gmail-address@gmail.com");
                defaultProps.setProperty("sender.password", "your-gmail-app-password-here");
                defaultProps.setProperty("receiver.email", "host-receipt-email@gmail.com");
                defaultProps.store(output, "Sai Sankalp Email Server Configurations");
            } catch (IOException io) {
                System.err.println("Could not create config.properties template: " + io.getMessage());
            }
        }
    }

    /**
     * Ensure database files exist, write headers if new CSV
     */
    private static void ensureDatabaseExists() {
        try {
            Files.createDirectories(Paths.get(DATA_DIR));
            Path csvPath = Paths.get(CSV_DB);
            
            // Overwrite headers if they don't match the new schema
            boolean writeNewHeaders = false;
            if (!Files.exists(csvPath)) {
                writeNewHeaders = true;
            } else {
                // If it's the old schema, let's delete it so it updates with GST and Payment method columns
                String firstLine = Files.lines(csvPath).findFirst().orElse("");
                if (!firstLine.contains("CGST")) {
                    System.out.println("Old CSV schema detected. Backing up and updating to new payments schema.");
                    Files.move(csvPath, Paths.get(DATA_DIR + "/orders_backup_" + System.currentTimeMillis() + ".csv"));
                    writeNewHeaders = true;
                }
            }

            if (writeNewHeaders) {
                String headers = "Order ID,Timestamp,Customer Name,Gmail,Mobile,Subtotal,CGST (2.5%),SGST (2.5%),Total Paid,Payment Method,Payment Details,Shipping Address,Items Purchased\n";
                Files.write(csvPath, headers.getBytes(StandardCharsets.UTF_8));
                System.out.println("Created new CSV database: " + CSV_DB);
            }

            Path jsonPath = Paths.get(JSON_DB);
            if (!Files.exists(jsonPath)) {
                Files.write(jsonPath, "[]".getBytes(StandardCharsets.UTF_8));
                System.out.println("Created new JSON database: " + JSON_DB);
            }

            Path testCsvPath = Paths.get(DATA_DIR, "test_orders.csv");
            if (!Files.exists(testCsvPath)) {
                String testHeaders = "Order ID,Timestamp,Customer Name,Gmail,Mobile,Subtotal,CGST (2.5%),SGST (2.5%),Total Paid,Payment Method,Payment Details,Shipping Address,Items Purchased,Order Status,Transaction ID\n";
                Files.write(testCsvPath, testHeaders.getBytes(StandardCharsets.UTF_8));
                System.out.println("Created new Test CSV database: test_orders.csv");
            }
            Path testJsonPath = Paths.get(DATA_DIR, "test_orders.json");
            if (!Files.exists(testJsonPath)) {
                Files.write(testJsonPath, "[]".getBytes(StandardCharsets.UTF_8));
                System.out.println("Created new Test JSON database: test_orders.json");
            }

            Path usersJsonPath = Paths.get(DATA_DIR, "users.json");
            if (!Files.exists(usersJsonPath)) {
                String defaultUsers = "[\n" +
                    "  {\n" +
                    "    \"email\": \"saisameermarla@gmail.com\",\n" +
                    "    \"passwordHash\": \"" + hashPassword("admin123") + "\",\n" +
                    "    \"verified\": true,\n" +
                    "    \"role\": \"admin\"\n" +
                    "  },\n" +
                    "  {\n" +
                    "    \"email\": \"saisameermaral@gmail.com\",\n" +
                    "    \"passwordHash\": \"" + hashPassword("admin123") + "\",\n" +
                    "    \"verified\": true,\n" +
                    "    \"role\": \"admin\"\n" +
                    "  },\n" +
                    "  {\n" +
                    "    \"email\": \"john@gmail.com\",\n" +
                    "    \"passwordHash\": \"" + hashPassword("john123") + "\",\n" +
                    "    \"verified\": true,\n" +
                    "    \"role\": \"customer\"\n" +
                    "  }\n" +
                    "]";
                Files.write(usersJsonPath, defaultUsers.getBytes(StandardCharsets.UTF_8));
                System.out.println("Created new users JSON database: users.json");
            }
        } catch (IOException e) {
            System.err.println("Error initializing database folder: " + e.getMessage());
        }
    }

    /**
     * Handler to serve static frontend files (HTML, CSS, JS, Images)
     */
    static class StaticFileHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String pathStr = exchange.getRequestURI().getPath();
            
            // Default to index.html for root path
            if (pathStr.equals("/")) {
                pathStr = "/index.html";
            }
            
            // Remove leading slash to get relative path
            String relativePath = pathStr.substring(1);
            
            // Prevent directory traversal and block sensitive configuration/code files
            String lowercase = relativePath.toLowerCase();
            if (relativePath.contains("..") || relativePath.startsWith(".") ||
                lowercase.endsWith(".env") || lowercase.endsWith(".properties") ||
                lowercase.endsWith(".java") || lowercase.endsWith(".class") ||
                lowercase.endsWith(".db") || lowercase.endsWith(".sqlite") ||
                lowercase.endsWith(".py") || lowercase.endsWith(".csv") ||
                lowercase.startsWith("data/") || lowercase.startsWith("data\\")) {
                String response = "403 Forbidden - Access to requested file is denied.";
                exchange.sendResponseHeaders(403, response.length());
                OutputStream os = exchange.getResponseBody();
                os.write(response.getBytes(StandardCharsets.UTF_8));
                os.close();
                return;
            }

            Path filePath = Paths.get(STATIC_DIR, relativePath);
            
            File file = filePath.toFile();
            
            // Check if file exists and is not a directory
            if (!file.exists() || file.isDirectory()) {
                String response = "404 Not Found - The file you requested does not exist.";
                exchange.sendResponseHeaders(404, response.length());
                OutputStream os = exchange.getResponseBody();
                os.write(response.getBytes());
                os.close();
                return;
            }
            
            // Determine content type
            String contentType = getContentType(relativePath);
            exchange.getResponseHeaders().set("Content-Type", contentType);
            exchange.getResponseHeaders().set("Cache-Control", "no-cache, no-store, must-revalidate");
            exchange.getResponseHeaders().set("Pragma", "no-cache");
            exchange.getResponseHeaders().set("Expires", "0");
            
            // Read file and send bytes
            byte[] fileBytes = Files.readAllBytes(filePath);
            exchange.sendResponseHeaders(200, fileBytes.length);
            
            OutputStream os = exchange.getResponseBody();
            os.write(fileBytes);
            os.close();
        }

        private String getContentType(String path) {
            String lowercasePath = path.toLowerCase();
            if (lowercasePath.endsWith(".html") || lowercasePath.endsWith(".htm")) {
                return "text/html; charset=utf-8";
            } else if (lowercasePath.endsWith(".css")) {
                return "text/css";
            } else if (lowercasePath.endsWith(".js")) {
                return "application/javascript";
            } else if (lowercasePath.endsWith(".png")) {
                return "image/png";
            } else if (lowercasePath.endsWith(".jpg") || lowercasePath.endsWith(".jpeg")) {
                return "image/jpeg";
            } else if (lowercasePath.endsWith(".gif")) {
                return "image/gif";
            } else if (lowercasePath.endsWith(".svg")) {
                return "image/svg+xml";
            } else if (lowercasePath.endsWith(".json")) {
                return "application/json";
            }
            return "application/octet-stream";
        }
    }

    /**
     * Handler for `/api/products` JSON endpoint
     */
    static class ProductsApiHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
            exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Test-Mode");
            exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
            exchange.getResponseHeaders().set("Cache-Control", "no-cache, no-store, must-revalidate");
            exchange.getResponseHeaders().set("Pragma", "no-cache");
            exchange.getResponseHeaders().set("Expires", "0");

            if (isRateLimited(exchange)) {
                sendError(exchange, 429, "Too Many Requests. Rate limit exceeded.");
                return;
            }
            
            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            String method = exchange.getRequestMethod();
            Path path = Paths.get(DATA_DIR, "products.json");

            if ("GET".equalsIgnoreCase(method)) {
                if (!Files.exists(path)) {
                    seedProductsJson(path);
                }
                String productsContent = new String(Files.readAllBytes(path), StandardCharsets.UTF_8);
                java.util.List<String> productBlocks = parseJsonArray(productsContent);
                java.util.List<String> activeBlocks = new java.util.ArrayList<>();
                for (String block : productBlocks) {
                    if (!"true".equalsIgnoreCase(getJsonValue(block, "isDeleted"))) {
                        activeBlocks.add(block);
                    }
                }
                // Reconstruct JSON array string
                StringBuilder sb = new StringBuilder();
                sb.append("[\n");
                for (int i = 0; i < activeBlocks.size(); i++) {
                    sb.append(activeBlocks.get(i));
                    if (i < activeBlocks.size() - 1) {
                        sb.append(",\n");
                    }
                }
                sb.append("\n]");
                byte[] responseBytes = sb.toString().getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(200, responseBytes.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(responseBytes);
                }
            } else if ("POST".equalsIgnoreCase(method)) {
                if (!isAdmin(exchange)) {
                    sendError(exchange, 403, "Forbidden. Admin access required.");
                    return;
                }

                String body = readRequestBody(exchange);
                String productsContent = "";
                if (Files.exists(path)) {
                    productsContent = new String(Files.readAllBytes(path), StandardCharsets.UTF_8);
                }
                java.util.List<String> productBlocks = parseJsonArray(productsContent);

                int maxId = 0;
                for (String block : productBlocks) {
                    try {
                        String idVal = getJsonValue(block, "id");
                        int id = Integer.parseInt(idVal);
                        if (id > maxId) maxId = id;
                    } catch (Exception e) {}
                }
                int newId = maxId + 1;

                String title = getJsonValue(body, "title");
                String category = getJsonValue(body, "category");
                String priceStr = getJsonValue(body, "price");
                String description = getJsonValue(body, "description");
                String image = getJsonValue(body, "image");

                String categoryName = "Handmade Craft";
                if ("paper".equals(category)) categoryName = "Paper Craft";
                else if ("kerchief".equals(category)) categoryName = "Woolen Handkerchief";
                else if ("doll".equals(category)) categoryName = "Woolen Doll";

                SessionInfo session = getSession(exchange);
                String adminEmail = (session != null && session.email != null) ? session.email : "admin";

                java.util.TimeZone tz = java.util.TimeZone.getTimeZone("UTC");
                java.text.DateFormat df = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'");
                df.setTimeZone(tz);
                String nowAsISO = df.format(new java.util.Date());

                String newBlock = "{\n" +
                    "    \"id\": " + newId + ",\n" +
                    "    \"title\": \"" + escapeJsonString(title) + "\",\n" +
                    "    \"category\": \"" + escapeJsonString(category) + "\",\n" +
                    "    \"categoryName\": \"" + escapeJsonString(categoryName) + "\",\n" +
                    "    \"price\": " + priceStr + ",\n" +
                    "    \"rating\": 5.0,\n" +
                    "    \"reviews\": 0,\n" +
                    "    \"image\": \"" + escapeJsonString(image) + "\",\n" +
                    "    \"description\": \"" + escapeJsonString(description) + "\",\n" +
                    "    \"specs\": {\n" +
                    "      \"Material\": \"Handmade Craft\",\n" +
                    "      \"Care\": \"Handle with love\"\n" +
                    "    },\n" +
                    "    \"addedBy\": \"" + escapeJsonString(adminEmail) + "\",\n" +
                    "    \"addedAt\": \"" + escapeJsonString(nowAsISO) + "\",\n" +
                    "    \"deletedBy\": null,\n" +
                    "    \"deletedAt\": null,\n" +
                    "    \"isDeleted\": false\n" +
                    "  }";

                productBlocks.add(newBlock);
                saveProductsJson(path, productBlocks);

                byte[] responseBytes = newBlock.getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(200, responseBytes.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(responseBytes);
                }

            } else if ("DELETE".equalsIgnoreCase(method)) {
                if (!isAdmin(exchange)) {
                    sendError(exchange, 403, "Forbidden. Admin access required.");
                    return;
                }

                String query = exchange.getRequestURI().getQuery();
                String idStr = "";
                if (query != null && query.startsWith("id=")) {
                    idStr = query.substring(3);
                }

                if (idStr.isEmpty()) {
                    sendError(exchange, 400, "Missing id in query parameters.");
                    return;
                }

                if (!Files.exists(path)) {
                    sendError(exchange, 404, "Products database not found.");
                    return;
                }

                String productsContent = new String(Files.readAllBytes(path), StandardCharsets.UTF_8);
                java.util.List<String> productBlocks = parseJsonArray(productsContent);
                java.util.List<String> updatedBlocks = new java.util.ArrayList<>();
                boolean found = false;
                String targetImage = "";

                for (String block : productBlocks) {
                    String idVal = getJsonValue(block, "id");
                    if (idVal.equals(idStr)) {
                        found = true;
                        targetImage = getJsonValue(block, "image");

                        SessionInfo session = getSession(exchange);
                        String adminEmail = (session != null && session.email != null) ? session.email : "admin";

                        java.util.TimeZone tz = java.util.TimeZone.getTimeZone("UTC");
                        java.text.DateFormat df = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'");
                        df.setTimeZone(tz);
                        String nowAsISO = df.format(new java.util.Date());

                        // Extract specs block
                        String specsBlock = "{\n      \"Material\": \"Handmade Craft\",\n      \"Care\": \"Handle with love\"\n    }";
                        int specsIndex = block.indexOf("\"specs\":");
                        if (specsIndex != -1) {
                            int startBrace = block.indexOf("{", specsIndex);
                            if (startBrace != -1) {
                                int endBrace = block.indexOf("}", startBrace);
                                if (endBrace != -1) {
                                    specsBlock = block.substring(startBrace, endBrace + 1);
                                }
                            }
                        }

                        String deletedBlock = "{\n" +
                            "    \"id\": " + idVal + ",\n" +
                            "    \"title\": \"" + escapeJsonString(getJsonValue(block, "title")) + "\",\n" +
                            "    \"category\": \"" + escapeJsonString(getJsonValue(block, "category")) + "\",\n" +
                            "    \"categoryName\": \"" + escapeJsonString(getJsonValue(block, "categoryName")) + "\",\n" +
                            "    \"price\": " + getJsonValue(block, "price") + ",\n" +
                            "    \"rating\": " + getJsonValue(block, "rating") + ",\n" +
                            "    \"reviews\": " + getJsonValue(block, "reviews") + ",\n" +
                            "    \"image\": \"" + escapeJsonString(getJsonValue(block, "image")) + "\",\n" +
                            "    \"description\": \"" + escapeJsonString(getJsonValue(block, "description")) + "\",\n" +
                            "    \"specs\": " + specsBlock + ",\n" +
                            "    \"addedBy\": \"" + escapeJsonString(getJsonValue(block, "addedBy")) + "\",\n" +
                            "    \"addedAt\": \"" + escapeJsonString(getJsonValue(block, "addedAt")) + "\",\n" +
                            "    \"deletedBy\": \"" + escapeJsonString(adminEmail) + "\",\n" +
                            "    \"deletedAt\": \"" + escapeJsonString(nowAsISO) + "\",\n" +
                            "    \"isDeleted\": true\n" +
                            "  }";
                        updatedBlocks.add(deletedBlock);
                    } else {
                        updatedBlocks.add(block);
                    }
                }

                if (!found) {
                    sendError(exchange, 404, "Product with ID " + idStr + " not found.");
                    return;
                }

                saveProductsJson(path, updatedBlocks);

                // Delete the product's image file from disk
                java.util.Set<String> protectedImages = new java.util.HashSet<>(java.util.Arrays.asList(
                    "images/paper_journal.png",
                    "images/wool_kerchief.png",
                    "images/wool_doll.png",
                    "images/hero_crafts.png",
                    "images/upi_qr.jpg"
                ));

                if (!targetImage.isEmpty() && !protectedImages.contains(targetImage)) {
                    String cleanPath = targetImage;
                    if (cleanPath.startsWith("/")) {
                        cleanPath = cleanPath.substring(1);
                    }
                    try {
                        java.nio.file.Files.deleteIfExists(java.nio.file.Paths.get(cleanPath));
                        System.out.println("[DELETE] Removed image file: " + cleanPath);
                    } catch (Exception e) {
                        System.out.println("[DELETE] Warning: could not remove image file " + cleanPath + ": " + e.getMessage());
                    }
                }

                String success = "{\"status\":\"success\",\"message\":\"Product deleted successfully.\"}";
                byte[] responseBytes = success.getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(200, responseBytes.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(responseBytes);
                }
            } else {
                sendError(exchange, 405, "Method Not Allowed");
            }
        }
    }

    static class OrdersApiHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
            exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Test-Mode");
            exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            exchange.getResponseHeaders().set("Cache-Control", "no-cache, no-store, must-revalidate");
            exchange.getResponseHeaders().set("Pragma", "no-cache");
            exchange.getResponseHeaders().set("Expires", "0");

            if (isRateLimited(exchange)) {
                sendError(exchange, 429, "Too Many Requests. Rate limit exceeded.");
                return;
            }

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            String method = exchange.getRequestMethod();
            if ("GET".equalsIgnoreCase(method)) {
                if (!isAdmin(exchange)) {
                    sendError(exchange, 403, "Forbidden. Admin access required.");
                    return;
                }

                boolean isTest = isTestMode(exchange);
                String suffix = isTest ? "test_orders" : "orders";
                Path path = Paths.get(DATA_DIR, suffix + ".json");
                byte[] responseBytes;
                if (Files.exists(path)) {
                    responseBytes = Files.readAllBytes(path);
                } else {
                    responseBytes = "[]".getBytes(StandardCharsets.UTF_8);
                }
                exchange.sendResponseHeaders(200, responseBytes.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(responseBytes);
                }
            } else if ("POST".equalsIgnoreCase(method)) {
                try {
                    String jsonBody = readRequestBody(exchange);

                    // Parse Fields Natively
                    String customerName = sanitizeInput(getJsonValue(jsonBody, "customerName"));
                    String customerEmail = sanitizeInput(getJsonValue(jsonBody, "customerEmail"));
                    String customerMobile = sanitizeInput(getJsonValue(jsonBody, "customerMobile"));
                    String customerAddress = sanitizeInput(getJsonValue(jsonBody, "customerAddress"));
                    String paymentMethod = sanitizeInput(getJsonValue(jsonBody, "paymentMethod"));
                    String paymentDetails = sanitizeInput(getJsonValue(jsonBody, "paymentDetails"));
                    String subtotal = sanitizeInput(getJsonValue(jsonBody, "subtotal"));
                    String cgst = sanitizeInput(getJsonValue(jsonBody, "cgst"));
                    String sgst = sanitizeInput(getJsonValue(jsonBody, "sgst"));
                    String totalAmount = sanitizeInput(getJsonValue(jsonBody, "totalAmount"));
                    
                    // Verify transaction ID and payment status
                    String txnId = sanitizeInput(getJsonValue(jsonBody, "transactionId"));
                    if (txnId == null || txnId.isEmpty()) {
                        sendError(exchange, 400, "Missing transactionId. Order cannot be created without verified payment.");
                        return;
                    }

                    boolean isTest = isTestMode(exchange);
                    java.util.Map<String, PaymentInfo> dbPayments = isTest ? TEST_PAYMENTS : PAYMENTS;
                    PaymentInfo txn = dbPayments.get(txnId);
                    if (txn == null) {
                        sendError(exchange, 400, "Invalid transaction ID. Order cannot be created.");
                        return;
                    }

                    if (!"success".equals(txn.status)) {
                        sendError(exchange, 400, "Payment is not verified (status: " + txn.status + "). Order cannot be created.");
                        return;
                    }

                    if (txn.used) {
                        sendError(exchange, 400, "This payment transaction has already been used for another order.");
                        return;
                    }

                    // Verify transaction amount matches order total amount
                    try {
                        double txnAmount = txn.amount;
                        double orderAmount = Double.parseDouble(totalAmount);
                        if (Math.abs(txnAmount - orderAmount) > 0.01) {
                            sendError(exchange, 400, "Transaction amount mismatch. Paid: " + txnAmount + ", Order: " + orderAmount + ".");
                            return;
                        }
                    } catch (Exception e) {
                        sendError(exchange, 400, "Invalid amount format: " + e.getMessage());
                        return;
                    }

                    // Mark as used to prevent replay attacks
                    txn.used = true;
                    
                    // Extract items details (simple text extract)
                    String itemsPurchased = extractItemsSummary(jsonBody);

                    // Generate Order ID & Timestamp
                    String prefix = isTest ? "SS-TEST-" : "SS-";
                    String orderId = prefix + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
                    String timestamp = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new Date());

                    // Save to JSON Database (which also handles status injection and calls syncCsvFromJson)
                    saveToJson(orderId, timestamp, jsonBody, isTest);

                    // Send email notification (placed)
                    String orderBlock = "{\"orderId\":\"" + orderId + "\",\"timestamp\":\"" + timestamp + "\",\"details\":" + "{\"status\":\"Pending\"," + jsonBody.substring(1) + "}";
                    new Thread(() -> {
                        try {
                            simulateOrderEmail(orderBlock, "placed", isTest);
                        } catch (Exception e) {
                            System.err.println("Email notification failed: " + e.getMessage());
                        }
                    }).start();

                    // Respond with success
                    String successResponse = "{\"status\":\"success\",\"orderId\":\"" + orderId + "\"}";
                    exchange.sendResponseHeaders(200, successResponse.length());
                    try (OutputStream os = exchange.getResponseBody()) {
                        os.write(successResponse.getBytes());
                    }

                } catch (Exception e) {
                    System.err.println("Error processing order: " + e.getMessage());
                    e.printStackTrace();
                    sendError(exchange, 500, e.getMessage());
                }
            } else if ("DELETE".equalsIgnoreCase(method)) {
                if (!isAdmin(exchange)) {
                    sendError(exchange, 403, "Forbidden. Admin access required.");
                    return;
                }

                String query = exchange.getRequestURI().getQuery();
                String orderId = null;
                if (query != null) {
                    for (String param : query.split("&")) {
                        String[] pair = param.split("=");
                        if (pair.length > 1 && "orderId".equals(pair[0])) {
                            orderId = pair[1];
                            break;
                        }
                    }
                }

                if (orderId == null || orderId.isEmpty()) {
                    sendError(exchange, 400, "Missing orderId");
                    return;
                }

                try {
                    boolean isTest = isTestMode(exchange);
                    String suffix = isTest ? "test_orders" : "orders";
                    Path path = Paths.get(DATA_DIR, suffix + ".json");
                    if (!Files.exists(path)) {
                        sendError(exchange, 404, "Orders database not found");
                        return;
                    }

                    String jsonContent = new String(Files.readAllBytes(path), StandardCharsets.UTF_8);
                    java.util.List<String> orderBlocks = parseJsonArray(jsonContent);
                    java.util.List<String> remainingBlocks = new java.util.ArrayList<>();
                    boolean found = false;

                    for (String block : orderBlocks) {
                        String blockId = getJsonValue(block, "orderId");
                        if (orderId.equals(blockId)) {
                            found = true;
                        } else {
                            remainingBlocks.add(block);
                        }
                    }

                    if (!found) {
                        sendError(exchange, 404, "Order not found");
                        return;
                    }

                    // Save remaining orders back to json
                    StringBuilder sb = new StringBuilder();
                    sb.append("[\n");
                    for (int i = 0; i < remainingBlocks.size(); i++) {
                        sb.append("  ").append(remainingBlocks.get(i));
                        if (i < remainingBlocks.size() - 1) sb.append(",\n");
                    }
                    sb.append("\n]");
                    Files.write(path, sb.toString().getBytes(StandardCharsets.UTF_8), java.nio.file.StandardOpenOption.CREATE, java.nio.file.StandardOpenOption.TRUNCATE_EXISTING);

                    // Sync to CSV
                    syncCsvFromJson(isTest);

                    String successResponse = "{\"status\":\"success\",\"message\":\"Order " + orderId + " deleted successfully\"}";
                    exchange.sendResponseHeaders(200, successResponse.length());
                    try (OutputStream os = exchange.getResponseBody()) {
                        os.write(successResponse.getBytes());
                    }
                } catch (Exception e) {
                    sendError(exchange, 500, e.getMessage());
                }
            } else {
                sendError(exchange, 405, "Method Not Allowed");
            }
        }
    }

    static class PaymentsInitiateHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
            exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Test-Mode");
            exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "POST, OPTIONS");

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            if (isRateLimited(exchange)) {
                sendError(exchange, 429, "Too Many Requests. Rate limit exceeded.");
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    String jsonBody = readRequestBody(exchange);
                    String amountStr = getJsonValue(jsonBody, "amount");
                    if (amountStr == null || amountStr.isEmpty()) {
                        sendError(exchange, 400, "Missing amount");
                        return;
                    }

                    double amount = Double.parseDouble(amountStr);
                    String txnId = "TXN-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
                    PaymentInfo txn = new PaymentInfo(txnId, amount);
                    
                    boolean isTest = isTestMode(exchange);
                    if (isTest) {
                        TEST_PAYMENTS.put(txnId, txn);
                    } else {
                        PAYMENTS.put(txnId, txn);
                    }

                    String response = "{\"transactionId\":\"" + txnId + "\",\"status\":\"pending\",\"amount\":" + amount + "}";
                    byte[] responseBytes = response.getBytes(StandardCharsets.UTF_8);
                    exchange.sendResponseHeaders(200, responseBytes.length);
                    try (OutputStream os = exchange.getResponseBody()) {
                        os.write(responseBytes);
                    }
                } catch (Exception e) {
                    sendError(exchange, 400, "Invalid request: " + e.getMessage());
                }
            } else {
                sendError(exchange, 405, "Method Not Allowed");
            }
        }
    }

    static class PaymentsStatusHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
            exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Test-Mode");
            exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, OPTIONS");

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            if (isRateLimited(exchange)) {
                sendError(exchange, 429, "Too Many Requests. Rate limit exceeded.");
                return;
            }

            if ("GET".equalsIgnoreCase(exchange.getRequestMethod())) {
                String query = exchange.getRequestURI().getQuery();
                String txnId = null;
                if (query != null) {
                    for (String param : query.split("&")) {
                        String[] pair = param.split("=");
                        if (pair.length > 1 && "transactionId".equals(pair[0])) {
                            txnId = pair[1];
                            break;
                        }
                    }
                }

                if (txnId == null || txnId.isEmpty()) {
                    sendError(exchange, 400, "Missing transactionId");
                    return;
                }

                boolean isTest = isTestMode(exchange);
                java.util.Map<String, PaymentInfo> dbPayments = isTest ? TEST_PAYMENTS : PAYMENTS;
                PaymentInfo txn = dbPayments.get(txnId);
                if (txn == null) {
                    sendError(exchange, 404, "Transaction not found");
                    return;
                }

                String response = "{\"transactionId\":\"" + txnId + "\",\"status\":\"" + txn.status + "\",\"amount\":" + txn.amount + "}";
                byte[] responseBytes = response.getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(200, responseBytes.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(responseBytes);
                }
            } else {
                sendError(exchange, 405, "Method Not Allowed");
            }
        }
    }

    static class PaymentsWebhookHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
            exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Test-Mode");
            exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "POST, OPTIONS");

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            if (isRateLimited(exchange)) {
                sendError(exchange, 429, "Too Many Requests. Rate limit exceeded.");
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    String jsonBody = readRequestBody(exchange);
                    String txnId = getJsonValue(jsonBody, "transactionId");
                    String status = getJsonValue(jsonBody, "status");

                    if (txnId == null || txnId.isEmpty() || status == null || status.isEmpty()) {
                        sendError(exchange, 400, "Missing transactionId or status");
                        return;
                    }

                    if (!"success".equals(status) && !"failed".equals(status) && !"cancelled".equals(status)) {
                        sendError(exchange, 400, "Invalid status");
                        return;
                    }

                    boolean isTest = isTestMode(exchange);
                    java.util.Map<String, PaymentInfo> dbPayments = isTest ? TEST_PAYMENTS : PAYMENTS;
                    PaymentInfo txn = dbPayments.get(txnId);
                    if (txn == null) {
                        sendError(exchange, 404, "Transaction not found");
                        return;
                    }

                    txn.status = status;

                    String response = "{\"status\":\"success\",\"message\":\"Transaction " + txnId + " updated to " + status + "\"}";
                    byte[] responseBytes = response.getBytes(StandardCharsets.UTF_8);
                    exchange.sendResponseHeaders(200, responseBytes.length);
                    try (OutputStream os = exchange.getResponseBody()) {
                        os.write(responseBytes);
                    }
                } catch (Exception e) {
                    sendError(exchange, 400, "Invalid request: " + e.getMessage());
                }
            } else {
                sendError(exchange, 405, "Method Not Allowed");
            }
        }
    }

    static class OrdersUpdateStatusHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
            exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Test-Mode");
            exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "POST, OPTIONS");

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            if (isRateLimited(exchange)) {
                sendError(exchange, 429, "Too Many Requests. Rate limit exceeded.");
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                if (!isAdmin(exchange)) {
                    sendError(exchange, 403, "Forbidden. Admin access required.");
                    return;
                }

                try {
                    String jsonBody = readRequestBody(exchange);
                    String orderId = getJsonValue(jsonBody, "orderId");
                    String status = getJsonValue(jsonBody, "status");

                    if (orderId == null || orderId.isEmpty() || status == null || status.isEmpty()) {
                        sendError(exchange, 400, "Missing orderId or status");
                        return;
                    }

                    java.util.List<String> validStatuses = java.util.Arrays.asList("Pending", "Confirmed", "Processing", "Shipped", "Out for Delivery", "Delivered", "Cancelled", "Refunded");
                    if (!validStatuses.contains(status)) {
                        sendError(exchange, 400, "Invalid status: " + status);
                        return;
                    }

                    boolean isTest = isTestMode(exchange);
                    String suffix = isTest ? "test_orders" : "orders";
                    Path path = Paths.get(DATA_DIR, suffix + ".json");
                    if (!Files.exists(path)) {
                        sendError(exchange, 404, "Orders database not found");
                        return;
                    }

                    String jsonContent = new String(Files.readAllBytes(path), StandardCharsets.UTF_8);
                    java.util.List<String> orderBlocks = parseJsonArray(jsonContent);
                    java.util.List<String> updatedBlocks = new java.util.ArrayList<>();
                    String targetBlock = null;

                    for (String block : orderBlocks) {
                        String blockId = getJsonValue(block, "orderId");
                        if (orderId.equals(blockId)) {
                            int detailsStart = block.indexOf("\"details\":{");
                            if (detailsStart != -1) {
                                String prefix = block.substring(0, detailsStart + 11);
                                String detailsVal = block.substring(detailsStart + 11, block.length() - 1);
                                
                                String updatedDetails;
                                if (detailsVal.contains("\"status\":\"")) {
                                    updatedDetails = detailsVal.replaceAll("\"status\":\"[^\"]*\"", "\"status\":\"" + status + "\"");
                                } else {
                                    updatedDetails = "\"status\":\"" + status + "\"," + detailsVal;
                                }
                                targetBlock = prefix + updatedDetails + "}";
                                updatedBlocks.add(targetBlock);
                            } else {
                                updatedBlocks.add(block);
                            }
                        } else {
                            updatedBlocks.add(block);
                        }
                    }

                    if (targetBlock == null) {
                        sendError(exchange, 404, "Order not found");
                        return;
                    }

                    StringBuilder sb = new StringBuilder();
                    sb.append("[\n");
                    for (int i = 0; i < updatedBlocks.size(); i++) {
                        sb.append("  ").append(updatedBlocks.get(i));
                        if (i < updatedBlocks.size() - 1) sb.append(",\n");
                    }
                    sb.append("\n]");
                    Files.write(path, sb.toString().getBytes(StandardCharsets.UTF_8), StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);

                    syncCsvFromJson(isTest);

                    String emailEvent = "placed";
                    if ("Confirmed".equals(status)) emailEvent = "confirmed";
                    else if ("Processing".equals(status)) emailEvent = "processing";
                    else if ("Shipped".equals(status)) emailEvent = "shipped";
                    else if ("Out for Delivery".equals(status)) emailEvent = "out_for_delivery";
                    else if ("Delivered".equals(status)) emailEvent = "delivered";
                    else if ("Cancelled".equals(status)) emailEvent = "cancelled";
                    else if ("Refunded".equals(status)) emailEvent = "refunded";
                    
                    final String blockToEmail = targetBlock;
                    final String eventToEmail = emailEvent;
                    new Thread(() -> {
                        try {
                            simulateOrderEmail(blockToEmail, eventToEmail, isTest);
                        } catch (Exception e) {}
                    }).start();

                    String response = "{\"status\":\"success\",\"message\":\"Order status updated successfully\"}";
                    byte[] responseBytes = response.getBytes(StandardCharsets.UTF_8);
                    exchange.sendResponseHeaders(200, responseBytes.length);
                    try (OutputStream os = exchange.getResponseBody()) {
                        os.write(responseBytes);
                    }

                } catch (Exception e) {
                    sendError(exchange, 500, e.getMessage());
                }
            } else {
                sendError(exchange, 405, "Method Not Allowed");
            }
        }
    }

    static class OrdersResendEmailHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
            exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Test-Mode");
            exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "POST, OPTIONS");

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            if (isRateLimited(exchange)) {
                sendError(exchange, 429, "Too Many Requests. Rate limit exceeded.");
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                if (!isAdmin(exchange)) {
                    sendError(exchange, 403, "Forbidden. Admin access required.");
                    return;
                }

                try {
                    String jsonBody = readRequestBody(exchange);
                    String orderId = getJsonValue(jsonBody, "orderId");

                    if (orderId == null || orderId.isEmpty()) {
                        sendError(exchange, 400, "Missing orderId");
                        return;
                    }

                    boolean isTest = isTestMode(exchange);
                    String suffix = isTest ? "test_orders" : "orders";
                    Path path = Paths.get(DATA_DIR, suffix + ".json");
                    if (!Files.exists(path)) {
                        sendError(exchange, 404, "Orders database not found");
                        return;
                    }

                    String jsonContent = new String(Files.readAllBytes(path), StandardCharsets.UTF_8);
                    java.util.List<String> orderBlocks = parseJsonArray(jsonContent);
                    String targetBlock = null;

                    for (String block : orderBlocks) {
                        String blockId = getJsonValue(block, "orderId");
                        if (orderId.equals(blockId)) {
                            targetBlock = block;
                            break;
                        }
                    }

                    if (targetBlock == null) {
                        sendError(exchange, 404, "Order not found");
                        return;
                    }

                    String currentStatus = getJsonValue(targetBlock, "status");
                    if (currentStatus == null || currentStatus.isEmpty()) currentStatus = "Pending";
                    
                    String emailEvent = "placed";
                    if ("Confirmed".equals(currentStatus)) emailEvent = "confirmed";
                    else if ("Processing".equals(currentStatus)) emailEvent = "processing";
                    else if ("Shipped".equals(currentStatus)) emailEvent = "shipped";
                    else if ("Out for Delivery".equals(currentStatus)) emailEvent = "out_for_delivery";
                    else if ("Delivered".equals(currentStatus)) emailEvent = "delivered";
                    else if ("Cancelled".equals(currentStatus)) emailEvent = "cancelled";
                    else if ("Refunded".equals(currentStatus)) emailEvent = "refunded";

                    final String blockToEmail = targetBlock;
                    final String eventToEmail = emailEvent;
                    new Thread(() -> {
                        try {
                            simulateOrderEmail(blockToEmail, eventToEmail, isTest);
                        } catch (Exception e) {}
                    }).start();

                    String response = "{\"status\":\"success\",\"message\":\"Email resent successfully\"}";
                    byte[] responseBytes = response.getBytes(StandardCharsets.UTF_8);
                    exchange.sendResponseHeaders(200, responseBytes.length);
                    try (OutputStream os = exchange.getResponseBody()) {
                        os.write(responseBytes);
                    }

                } catch (Exception e) {
                    sendError(exchange, 500, e.getMessage());
                }
            } else {
                sendError(exchange, 405, "Method Not Allowed");
            }
        }
    }

    private static void syncCsvFromJson(boolean isTest) throws IOException {
        String suffix = isTest ? "test_orders" : "orders";
        Path jsonPath = Paths.get(DATA_DIR, suffix + ".json");
        Path csvPath = Paths.get(DATA_DIR, suffix + ".csv");
        if (!Files.exists(jsonPath)) return;
        
        String jsonContent = new String(Files.readAllBytes(jsonPath), StandardCharsets.UTF_8);
        java.util.List<String> orderBlocks = parseJsonArray(jsonContent);
        
        StringBuilder csvContent = new StringBuilder();
        csvContent.append("Order ID,Timestamp,Customer Name,Gmail,Mobile,Subtotal,CGST (2.5%),SGST (2.5%),Total Paid,Payment Method,Payment Details,Shipping Address,Items Purchased,Order Status,Transaction ID\n");
        
        for (String block : orderBlocks) {
            String orderId = getJsonValue(block, "orderId");
            String timestamp = getJsonValue(block, "timestamp");
            String customerName = getJsonValue(block, "customerName");
            String customerEmail = getJsonValue(block, "customerEmail");
            String customerMobile = getJsonValue(block, "customerMobile");
            String subtotal = getJsonValue(block, "subtotal");
            String cgst = getJsonValue(block, "cgst");
            String sgst = getJsonValue(block, "sgst");
            String totalAmount = getJsonValue(block, "totalAmount");
            String paymentMethod = getJsonValue(block, "paymentMethod");
            String paymentDetails = getJsonValue(block, "paymentDetails");
            String customerAddress = getJsonValue(block, "customerAddress");
            String itemsPurchased = extractItemsSummary(block);
            String status = getJsonValue(block, "status");
            if (status == null || status.isEmpty()) status = "Pending";
            String txnId = getJsonValue(block, "transactionId");
            
            String safeDetails = "\"" + paymentDetails.replace("\"", "\"\"") + "\"";
            String safeAddress = "\"" + customerAddress.replace("\"", "\"\"").replace("\n", " ").replace("\r", "") + "\"";
            String safeItems = "\"" + itemsPurchased.replace("\"", "\"\"") + "\"";
            
            csvContent.append(String.format("%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s\n",
                orderId, timestamp, customerName, customerEmail, customerMobile, subtotal, cgst, sgst, totalAmount, paymentMethod, safeDetails, safeAddress, safeItems, status, txnId));
        }
        
        Files.write(csvPath, csvContent.toString().getBytes(StandardCharsets.UTF_8), StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
        System.out.println("CSV database synchronized successfully: " + suffix + ".csv");
    }

    private static void syncCsvFromJson() throws IOException {
        syncCsvFromJson(false);
    }

    private static void simulateOrderEmail(String orderBlock, String event, boolean isTest) {
        String orderId = getJsonValue(orderBlock, "orderId");
        String timestamp = getJsonValue(orderBlock, "timestamp");
        String customerName = getJsonValue(orderBlock, "customerName");
        String customerEmail = getJsonValue(orderBlock, "customerEmail");
        String totalAmount = getJsonValue(orderBlock, "totalAmount");
        String subtotal = getJsonValue(orderBlock, "subtotal");
        String cgst = getJsonValue(orderBlock, "cgst");
        String sgst = getJsonValue(orderBlock, "sgst");
        String customerAddress = getJsonValue(orderBlock, "customerAddress");
        String status = getJsonValue(orderBlock, "status");
        if (status == null || status.isEmpty()) status = "Pending";
        String txnId = getJsonValue(orderBlock, "transactionId");
        String itemsPurchased = extractItemsSummary(orderBlock);

        String testPrefix = isTest ? " [SANDBOX TEST]" : "";

        String subject = "Update on your order: " + orderId + testPrefix;
        if ("placed".equals(event)) subject = "Your Sai Sankalp Order Confirmed!" + testPrefix + " - " + orderId;
        else if ("confirmed".equals(event)) subject = "Your Order " + orderId + " Has Been Confirmed!" + testPrefix;
        else if ("processing".equals(event)) subject = "Your Order " + orderId + " is Now Processing!" + testPrefix;
        else if ("shipped".equals(event)) subject = "Your Order " + orderId + " Has Been Shipped!" + testPrefix;
        else if ("out_for_delivery".equals(event)) subject = "Your Order " + orderId + " is Out for Delivery!" + testPrefix;
        else if ("delivered".equals(event)) subject = "Your Order " + orderId + " Has Been Delivered! \uD83C\uDF89" + testPrefix;
        else if ("cancelled".equals(event)) subject = "Your Order " + orderId + " Has Been Cancelled" + testPrefix;
        else if ("refunded".equals(event)) subject = "Your Order " + orderId + " Has Been Refunded" + testPrefix;

        String deliveryDate = "Pending";
        try {
            SimpleDateFormat df = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
            Date date = df.parse(timestamp);
            Date estDate = new Date(date.getTime() + 7L * 24L * 60L * 60L * 1000L);
            deliveryDate = new SimpleDateFormat("dd MMM yyyy").format(estDate);
        } catch (Exception e) {}

        System.out.println("\n================================================================================");
        System.out.println("  [SIMULATED SMTP EMAIL TO CUSTOMER (Event: " + event.toUpperCase() + ")" + testPrefix + "] (Server.java)");
        System.out.println("  From: orders@saisankalp.in");
        System.out.println("  To: " + customerEmail);
        System.out.println("  Subject: " + subject);
        System.out.println("  ----------------------------------------------------------------------");
        System.out.println("  Dear " + customerName + ",");
        System.out.println("\n  Here is an update on your hand-crafted order from Sai Sankalp!" + testPrefix);
        System.out.println("\n  [ORDER DETAILS]");
        System.out.println("   - Order ID: " + orderId);
        System.out.println("   - Payment Status: Paid (Verified Transaction: " + txnId + ")");
        System.out.println("   - Order Status: " + status);
        System.out.println("   - Estimated Delivery Date: " + deliveryDate);
        System.out.println("\n  [ITEMS PURCHASED]");
        System.out.println("   * " + itemsPurchased);
        System.out.println("\n  Subtotal: \u20b9" + subtotal);
        System.out.println("  CGST (2.5%): \u20b9" + cgst + " | SGST (2.5%): \u20b9" + sgst);
        System.out.println("  Total Paid Amount: \u20b9" + totalAmount);
        System.out.println("  Shipping Address: " + customerAddress);
        System.out.println("\n  Thank you for supporting traditional Indian artisans!");
        System.out.println("  Sai Sankalp Crafts - Premium Handmade Decor & Flowers");
        System.out.println("================================================================================\n");
    }

    private static void simulateOrderEmail(String orderBlock, String event) {
        simulateOrderEmail(orderBlock, event, false);
    }

    // --- JSON & Server Utility Helpers ---

    private static final String PASSWORD_SALT = "SAI_SANKALP_SECURE_SALT_2026";

    private static String hashPassword(String password) {
        return hashPasswordWithSalt(password, PASSWORD_SALT);
    }

    private static String hashPasswordLegacy(String password) {
        try {
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(password.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception ex) {
            throw new RuntimeException(ex);
        }
    }

    private static String hashPasswordWithSalt(String password, String salt) {
        try {
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest((password + salt).getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception ex) {
            throw new RuntimeException(ex);
        }
    }

    private static String sanitizeInput(String input) {
        if (input == null) return null;
        return input.replaceAll("<[^>]*>", "");
    }

    private static boolean isRateLimited(HttpExchange exchange) {
        String ip = exchange.getRemoteAddress().getAddress().getHostAddress();
        long now = System.currentTimeMillis();
        java.util.List<Long> timestamps = RATE_LIMITS.computeIfAbsent(ip, k -> new java.util.concurrent.CopyOnWriteArrayList<>());
        timestamps.removeIf(t -> now - t > 60000);
        if (timestamps.size() >= 60) {
            return true;
        }
        timestamps.add(now);
        return false;
    }

    private static SessionInfo getSession(HttpExchange exchange) {
        String authHeader = exchange.getRequestHeaders().getFirst("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return null;
        }
        String token = authHeader.substring(7).trim();
        SessionInfo session = SESSIONS.get(token);
        if (session == null) {
            return null;
        }
        if (System.currentTimeMillis() > session.expires) {
            SESSIONS.remove(token);
            return null;
        }
        return session;
    }

    private static boolean isAdmin(HttpExchange exchange) {
        SessionInfo session = getSession(exchange);
        return session != null && "admin".equalsIgnoreCase(session.role);
    }

    private static boolean isTestMode(HttpExchange exchange) {
        String testHeader = exchange.getRequestHeaders().getFirst("X-Test-Mode");
        if (testHeader != null && "true".equalsIgnoreCase(testHeader.trim())) {
            return true;
        }
        String query = exchange.getRequestURI().getQuery();
        if (query != null) {
            for (String param : query.split("&")) {
                String[] pair = param.split("=");
                if (pair.length > 1 && "isTest".equalsIgnoreCase(pair[0])) {
                    return "true".equalsIgnoreCase(pair[1].trim());
                }
            }
        }
        return false;
    }

    private static String readRequestBody(HttpExchange exchange) throws IOException {
        InputStream is = exchange.getRequestBody();
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        byte[] buffer = new byte[1024];
        int len;
        while ((len = is.read(buffer)) != -1) {
            bos.write(buffer, 0, len);
        }
        return bos.toString("UTF-8");
    }

    private static void sendError(HttpExchange exchange, int code, String msg) throws IOException {
        String errorJson = "{\"error\":\"" + escapeJsonString(msg) + "\"}";
        byte[] responseBytes = errorJson.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(code, responseBytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(responseBytes);
        }
    }

    private static String getJsonValue(String json, String key) {
        String pattern = "\"" + key + "\":\"";
        int start = json.indexOf(pattern);
        if (start != -1) {
            start += pattern.length();
            int end = json.indexOf("\"", start);
            if (end != -1) {
                return json.substring(start, end);
            }
        }
        // Try numeric/non-string values
        pattern = "\"" + key + "\":";
        start = json.indexOf(pattern);
        if (start != -1) {
            start += pattern.length();
            int end = json.indexOf(",", start);
            if (end == -1) {
                end = json.indexOf("}", start);
            }
            if (end != -1) {
                return json.substring(start, end).trim();
            }
        }
        return "";
    }

    private static String extractItemsSummary(String json) {
        StringBuilder summary = new StringBuilder();
        int index = 0;
        while (true) {
            int titleIndex = json.indexOf("\"title\":\"", index);
            if (titleIndex == -1) break;
            titleIndex += 9;
            int titleEnd = json.indexOf("\"", titleIndex);
            String title = json.substring(titleIndex, titleEnd);

            int qtyIndex = json.indexOf("\"quantity\":", titleEnd);
            int qtyEnd = json.indexOf(",", qtyIndex);
            if (qtyEnd == -1 || qtyEnd > json.indexOf("}", qtyIndex)) {
                qtyEnd = json.indexOf("}", qtyIndex);
            }
            String qty = json.substring(qtyIndex + 11, qtyEnd).trim();

            if (summary.length() > 0) {
                summary.append(" | ");
            }
            summary.append(title).append(" (x").append(qty).append(")");
            index = qtyEnd;
        }
        return summary.toString();
    }

    private static void saveToCsv(String id, String time, String name, String email, String mobile, String subtotal, String cgst, String sgst, String total, String method, String details, String address, String items) throws IOException {
        String safeDetails = "\"" + details.replace("\"", "\"\"") + "\"";
        String safeAddress = "\"" + address.replace("\"", "\"\"").replace("\n", " ").replace("\r", "") + "\"";
        String safeItems = "\"" + items.replace("\"", "\"\"") + "\"";
        
        String row = String.format("%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s\n", id, time, name, email, mobile, subtotal, cgst, sgst, total, method, safeDetails, safeAddress, safeItems);
        Files.write(Paths.get(CSV_DB), row.getBytes(StandardCharsets.UTF_8), StandardOpenOption.APPEND);
        System.out.println("Order " + id + " written to CSV database.");
    }

    private static void saveToJson(String id, String time, String orderJson, boolean isTest) throws IOException {
        String suffix = isTest ? "test_orders" : "orders";
        Path path = Paths.get(DATA_DIR, suffix + ".json");
        String content = new String(Files.readAllBytes(path), StandardCharsets.UTF_8).trim();
        
        // Inject status: Pending into orderDetails JSON
        String detailsJson = "{\"status\":\"Pending\"," + orderJson.substring(1);
        
        String orderRecord = "{" +
            "\"orderId\":\"" + id + "\"," +
            "\"timestamp\":\"" + time + "\"," +
            "\"details\":" + detailsJson +
            "}";

        String newContent;
        if (content.equals("[]")) {
            newContent = "[" + orderRecord + "]";
        } else {
            newContent = content.substring(0, content.length() - 1) + "," + orderRecord + "]";
        }
        
        Files.write(path, newContent.getBytes(StandardCharsets.UTF_8), StandardOpenOption.TRUNCATE_EXISTING);
        System.out.println("Order " + id + " written to JSON database: " + suffix + ".json");
        
        // Sync to CSV Database
        syncCsvFromJson(isTest);
    }

    private static void saveToJson(String id, String time, String orderJson) throws IOException {
        saveToJson(id, time, orderJson, false);
    }

    private static List<String> parseJsonArray(String content) {
        List<String> list = new java.util.ArrayList<>();
        if (content == null || content.trim().isEmpty()) return list;
        int braceCount = 0;
        int start = -1;
        for (int i = 0; i < content.length(); i++) {
            char c = content.charAt(i);
            if (c == '{') {
                if (braceCount == 0) start = i;
                braceCount++;
            } else if (c == '}') {
                braceCount--;
                if (braceCount == 0 && start != -1) {
                    list.add(content.substring(start, i + 1));
                    start = -1;
                }
            }
        }
        return list;
    }

    private static void saveProductsJson(Path path, List<String> blocks) throws IOException {
        StringBuilder sb = new StringBuilder();
        sb.append("[\n");
        for (int i = 0; i < blocks.size(); i++) {
            sb.append(blocks.get(i));
            if (i < blocks.size() - 1) {
                sb.append(",\n");
            }
        }
        sb.append("\n]");
        Files.write(path, sb.toString().getBytes(StandardCharsets.UTF_8), StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
    }

    private static String escapeJsonString(String val) {
        if (val == null) return "";
        return val.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r");
    }

    private static void seedProductsJson(Path path) throws IOException {
        String seed = "[\n" +
            "  {\n" +
            "    \"id\": 1,\n" +
            "    \"title\": \"Pressed Flower Journal\",\n" +
            "    \"category\": \"paper\",\n" +
            "    \"categoryName\": \"Paper Craft\",\n" +
            "    \"price\": 650.00,\n" +
            "    \"rating\": 4.8,\n" +
            "    \"reviews\": 24,\n" +
            "    \"image\": \"images/paper_journal.png\",\n" +
            "    \"description\": \"An elegant, hand-bound diary crafted from recycled cotton rag paper. The cover features real pressed garden wildflowers, beautifully preserved. Ideal for sketching, writing, or pressed flower collections.\",\n" +
            "    \"specs\": {\n" +
            "      \"Dimensions\": \"A5 (15 x 21 cm)\",\n" +
            "      \"Page Count\": \"120 pages (60 sheets)\",\n" +
            "      \"Paper Type\": \"Unruled, 150 GSM cotton paper\",\n" +
            "      \"Cover Material\": \"Hardcover, wildflower resin glaze\"\n" +
            "    },\n" +
            "    \"addedBy\": \"system\",\n" +
            "    \"addedAt\": \"2026-06-17T12:00:00Z\",\n" +
            "    \"deletedBy\": null,\n" +
            "    \"deletedAt\": null,\n" +
            "    \"isDeleted\": false\n" +
            "  },\n" +
            "  {\n" +
            "    \"id\": 2,\n" +
            "    \"title\": \"Hand-Embroidered Woolen Handkerchief\",\n" +
            "    \"category\": \"kerchief\",\n" +
            "    \"categoryName\": \"Woolen Handkerchief\",\n" +
            "    \"price\": 320.00,\n" +
            "    \"rating\": 4.9,\n" +
            "    \"reviews\": 18,\n" +
            "    \"image\": \"images/wool_kerchief.png\",\n" +
            "    \"description\": \"A soft, premium woolen pocket square woven from fine merino wool. Features a delicate, hand-stitched floral emblem on the corner. Soft, warm, and highly functional for cold climates.\",\n" +
            "    \"specs\": {\n" +
            "      \"Dimensions\": \"30 x 30 cm\",\n" +
            "      \"Material\": \"100% Australian Merino Wool\",\n" +
            "      \"Embroidery Yarn\": \"Organic dyed silk thread\",\n" +
            "      \"Care Instructions\": \"Hand wash cold, dry flat\"\n" +
            "    },\n" +
            "    \"addedBy\": \"system\",\n" +
            "    \"addedAt\": \"2026-06-17T12:00:00Z\",\n" +
            "    \"deletedBy\": null,\n" +
            "    \"deletedAt\": null,\n" +
            "    \"isDeleted\": false\n" +
            "  },\n" +
            "  {\n" +
            "    \"id\": 3,\n" +
            "    \"title\": \"Oliver the Knitted Bear Doll\",\n" +
            "    \"category\": \"doll\",\n" +
            "    \"categoryName\": \"Woolen Doll\",\n" +
            "    \"price\": 890.00,\n" +
            "    \"rating\": 5.0,\n" +
            "    \"reviews\": 32,\n" +
            "    \"image\": \"images/wool_doll.png\",\n" +
            "    \"description\": \"Oliver is a lovable, cuddle-ready teddy bear doll hand-knitted from thick, chemical-free wool yarn. Features a cozy red knitted scarf. A wonderful heirloom toy or decorative accent.\",\n" +
            "    \"specs\": {\n" +
            "      \"Height\": \"25 cm\",\n" +
            "      \"Material\": \"100% Organic Sheep Wool\",\n" +
            "      \"Filling\": \"Hypoallergenic pure cotton fill\",\n" +
            "      \"Safety\": \"Embroidered features (no plastic beads)\"\n" +
            "    },\n" +
            "    \"addedBy\": \"system\",\n" +
            "    \"addedAt\": \"2026-06-17T12:00:00Z\",\n" +
            "    \"deletedBy\": null,\n" +
            "    \"deletedAt\": null,\n" +
            "    \"isDeleted\": false\n" +
            "  },\n" +
            "  {\n" +
            "    \"id\": 4,\n" +
            "    \"title\": \"Quilled Floral Frame Art\",\n" +
            "    \"category\": \"paper\",\n" +
            "    \"categoryName\": \"Paper Craft\",\n" +
            "    \"price\": 1200.00,\n" +
            "    \"rating\": 4.7,\n" +
            "    \"reviews\": 12,\n" +
            "    \"image\": \"images/hero_crafts.png\",\n" +
            "    \"description\": \"An intricate shadowbox art frame featuring three-dimensional quilled paper flowers. Meticulously rolled, shaped, and glued by hand using vibrant, fade-resistant artisan paper sheets.\",\n" +
            "    \"specs\": {\n" +
            "      \"Dimensions\": \"20 x 20 x 3 cm\",\n" +
            "      \"Frame\": \"Sustainable pine wood with safety glass\",\n" +
            "      \"Paper\": \"120 GSM colored acid-free paper\",\n" +
            "      \"Mount\": \"Shadowbox art frame\"\n" +
            "    },\n" +
            "    \"addedBy\": \"system\",\n" +
            "    \"addedAt\": \"2026-06-17T12:00:00Z\",\n" +
            "    \"deletedBy\": null,\n" +
            "    \"deletedAt\": null,\n" +
            "    \"isDeleted\": false\n" +
            "  },\n" +
            "  {\n" +
            "    \"id\": 5,\n" +
            "    \"title\": \"Sage Lace Woolen Handkerchief\",\n" +
            "    \"category\": \"kerchief\",\n" +
            "    \"categoryName\": \"Woolen Handkerchief\",\n" +
            "    \"price\": 380.00,\n" +
            "    \"rating\": 4.6,\n" +
            "    \"reviews\": 15,\n" +
            "    \"image\": \"images/wool_kerchief.png\",\n" +
            "    \"description\": \"Woven wool handkerchief in a rich cream base, framed with hand-crocheted cotton lace borders in sage green. A premium vintage-inspired design that makes a memorable gift.\",\n" +
            "    \"specs\": {\n" +
            "      \"Dimensions\": \"28 x 28 cm\",\n" +
            "      \"Material\": \"90% Sheep Wool, 10% Cashmere blend\",\n" +
            "      \"Lace Border\": \"100% Crocheted Cotton\",\n" +
            "      \"Care Instructions\": \"Dry clean recommended\"\n" +
            "    },\n" +
            "    \"addedBy\": \"system\",\n" +
            "    \"addedAt\": \"2026-06-17T12:00:00Z\",\n" +
            "    \"deletedBy\": null,\n" +
            "    \"deletedAt\": null,\n" +
            "    \"isDeleted\": false\n" +
            "  },\n" +
            "  {\n" +
            "    \"id\": 6,\n" +
            "    \"title\": \"Crochet Woodland Fawn Doll\",\n" +
            "    \"category\": \"doll\",\n" +
            "    \"categoryName\": \"Woolen Doll\",\n" +
            "    \"price\": 950.00,\n" +
            "    \"rating\": 4.9,\n" +
            "    \"reviews\": 21,\n" +
            "    \"image\": \"images/wool_doll.png\",\n" +
            "    \"description\": \"A whimsical woodland fawn, hand-crocheted (amigurumi style) with premium wool-acrylic blended yarn. Stuffed with love, featuring sleepy eyes and a tiny crocheted flower crown.\",\n" +
            "    \"specs\": {\n" +
            "      \"Height\": \"30 cm\",\n" +
            "      \"Material\": \"60% Alpaca Wool, 40% Soft Acrylic\",\n" +
            "      \"Filling\": \"Recycled eco-fiber stuffing\",\n" +
            "      \"Care\": \"Gently hand wash in lukewarm water\"\n" +
            "    },\n" +
            "    \"addedBy\": \"system\",\n" +
            "    \"addedAt\": \"2026-06-17T12:00:00Z\",\n" +
            "    \"deletedBy\": null,\n" +
            "    \"deletedAt\": null,\n" +
            "    \"isDeleted\": false\n" +
            "  }\n" +
            "]";
        Files.write(path, seed.getBytes(StandardCharsets.UTF_8), StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
    }

    private static void sendNotificationEmail(String id, String time, String name, String email, String mobile, String address, String items, String subtotal, String cgst, String sgst, String total, String method, String details) {
        String smtpHost = config.getProperty("smtp.host");
        String smtpPortStr = config.getProperty("smtp.port");
        String senderEmail = config.getProperty("sender.email");
        String senderPass = config.getProperty("sender.password");
        String receiverEmail = config.getProperty("receiver.email");

        if (receiverEmail == null || receiverEmail.trim().isEmpty() || receiverEmail.contains("host-receipt-email")) {
            receiverEmail = "saisameermarla@gmail.com";
        }

        String deliveryDateStr = "";
        try {
            java.util.Calendar cal = java.util.Calendar.getInstance();
            cal.add(java.util.Calendar.DAY_OF_MONTH, 7);
            java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("dd MMM yyyy");
            deliveryDateStr = sdf.format(cal.getTime());
        } catch (Exception ex) {
            deliveryDateStr = "Within 7 business days";
        }

        if (smtpHost == null || senderEmail == null || senderEmail.contains("your-gmail-address") || senderPass == null) {
            System.out.println("\n==================================================");
            System.out.println("  [SIMULATED SMTP EMAIL TO ADMIN] (Server.java)");
            System.out.println("  From: system@saisankalp.in");
            System.out.println("  To: " + receiverEmail);
            System.out.println("  Subject: New Order Received: " + id + " - Sai Sankalp");
            System.out.println("  --------------------------------------------------");
            System.out.println("  Admin Contact Reference: 9361483584");
            System.out.println("  Customer Info: " + name + " (" + email + ", " + mobile + ")");
            System.out.println("  Shipping Address: " + address);
            System.out.println("  Product Details: " + items);
            System.out.println("  Ship By Date: " + deliveryDateStr);
            System.out.println("  Payment details: " + method + " (" + details + ")");
            System.out.println("  Subtotal: ₹" + subtotal + " | CGST: ₹" + cgst + " | SGST: ₹" + sgst);
            System.out.println("  Total Purchase Amount: ₹" + total);
            System.out.println("==================================================\n");

            System.out.println("==================================================");
            System.out.println("  [SIMULATED SMTP EMAIL TO CUSTOMER] (Server.java)");
            System.out.println("  From: orders@saisankalp.in");
            System.out.println("  To: " + email);
            System.out.println("  Subject: Your Sai Sankalp Order Confirmed! - " + id);
            System.out.println("  --------------------------------------------------");
            System.out.println("  Dear " + name + ",");
            System.out.println("  Thank you for purchasing handmade crafts from Sai Sankalp!");
            System.out.println("  Your order is being processed and will be delivered by: " + deliveryDateStr);
            System.out.println("\n  [ORDER SUMMARY]");
            System.out.println("   - Items: " + items);
            System.out.println("  Subtotal: ₹" + subtotal);
            System.out.println("  CGST (2.5%): ₹" + cgst + " | SGST (2.5%): ₹" + sgst);
            System.out.println("  Total Paid: ₹" + total);
            System.out.println("  Shipping Address: " + address);
            System.out.println("\n  If you have any questions, please contact us at " + receiverEmail + " or call 9361483584.");
            System.out.println("==================================================\n");
            return;
        }

        int smtpPort = 587;
        try {
            smtpPort = Integer.parseInt(smtpPortStr);
        } catch (NumberFormatException e) {}

        // Send to Admin
        String adminSubject = "New Order Received: " + id + " - Sai Sankalp";
        String adminEmailBody = "<html><body>" +
            "<h2 style='color: #D36E50;'>New Order Notification</h2>" +
            "<p>A customer has placed a new order on <strong>Sai Sankalp</strong> storefront.</p>" +
            "<table border='1' cellpadding='8' style='border-collapse:collapse; border-color:#E6DFD9;'>" +
            "  <tr bgcolor='#FAF8F5'><td><strong>Order ID</strong></td><td>" + id + "</td></tr>" +
            "  <tr><td><strong>Timestamp</strong></td><td>" + time + "</td></tr>" +
            "  <tr bgcolor='#FAF8F5'><td><strong>Customer Name</strong></td><td>" + name + "</td></tr>" +
            "  <tr><td><strong>Gmail / Email</strong></td><td>" + email + "</td></tr>" +
            "  <tr bgcolor='#FAF8F5'><td><strong>Mobile Number</strong></td><td>" + mobile + "</td></tr>" +
            "  <tr><td><strong>Shipping Address</strong></td><td>" + address.replace("\n", "<br>") + "</td></tr>" +
            "  <tr bgcolor='#FAF8F5'><td><strong>Items Ordered</strong></td><td>" + items.replace(" | ", "<br>") + "</td></tr>" +
            "  <tr><td><strong>Payment Method</strong></td><td>" + method + " (" + details + ")</td></tr>" +
            "  <tr bgcolor='#FAF8F5'><td><strong>Subtotal</strong></td><td>₹" + subtotal + "</td></tr>" +
            "  <tr><td><strong>CGST (2.5%)</strong></td><td>₹" + cgst + "</td></tr>" +
            "  <tr bgcolor='#FAF8F5'><td><strong>SGST (2.5%)</strong></td><td>₹" + sgst + "</td></tr>" +
            "  <tr><td><strong>Total Paid (incl. Taxes)</strong></td><td><strong>₹" + total + "</strong></td></tr>" +
            "  <tr bgcolor='#FAF8F5'><td><strong>Delivery Target Date</strong></td><td><strong>" + deliveryDateStr + "</strong></td></tr>" +
            "</table>" +
            "<br>" +
            "<p>Please process the shipment from your local orders database.</p>" +
            "</body></html>";

        try {
            System.out.println("Connecting to SMTP server " + smtpHost + ":" + smtpPort + " to notify Host...");
            SmtpClient.sendEmail(smtpHost, smtpPort, senderEmail, senderPass, receiverEmail, adminSubject, adminEmailBody);
            System.out.println("Order email successfully sent to Admin: " + receiverEmail);
        } catch (Exception e) {
            System.err.println("SMTP Error sending email to Admin: " + e.getMessage());
        }

        // Send to Customer
        String customerSubject = "Your Sai Sankalp Order Confirmed! - " + id;
        String customerEmailBody = "<html><body style='font-family: Arial, sans-serif; color: #4A4A4A; background-color: #FAF8F5; padding: 20px;'>" +
            "<div style='max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border: 1px solid #E6DFD9; border-radius: 8px; padding: 30px;'>" +
            "  <h2 style='color: #D36E50; border-bottom: 2px solid #F3ECE6; padding-bottom: 10px;'>Your Order is Confirmed!</h2>" +
            "  <p>Dear " + name + ",</p>" +
            "  <p>Thank you for purchasing handmade crafts from <strong>Sai Sankalp</strong>. We are handcrafting your items with love and care!</p>" +
            "  <p>Your order is expected to be delivered by: <strong>" + deliveryDateStr + "</strong></p>" +
            "  <h3 style='color: #4A4A4A; margin-top: 25px;'>Order Summary</h3>" +
            "  <table border='0' cellpadding='6' cellspacing='0' style='width: 100%; border-collapse: collapse;'>" +
            "    <tr style='border-bottom: 1px solid #E6DFD9;'><td style='padding: 8px 0;'><strong>Items:</strong></td><td style='text-align: right; padding: 8px 0;'>" + items.replace(" | ", "<br>") + "</td></tr>" +
            "    <tr style='border-bottom: 1px solid #E6DFD9;'><td style='padding: 8px 0;'>Subtotal:</td><td style='text-align: right; padding: 8px 0;'>₹" + subtotal + "</td></tr>" +
            "    <tr style='border-bottom: 1px solid #E6DFD9;'><td style='padding: 8px 0;'>CGST (2.5%):</td><td style='text-align: right; padding: 8px 0;'>₹" + cgst + "</td></tr>" +
            "    <tr style='border-bottom: 1px solid #E6DFD9;'><td style='padding: 8px 0;'>SGST (2.5%):</td><td style='text-align: right; padding: 8px 0;'>₹" + sgst + "</td></tr>" +
            "    <tr style='font-size: 1.1em; font-weight: bold; color: #D36E50;'><td style='padding: 12px 0 0 0;'>Total Paid:</td><td style='text-align: right; padding: 12px 0 0 0;'>₹" + total + "</td></tr>" +
            "  </table>" +
            "  <h3 style='color: #4A4A4A; margin-top: 25px;'>Shipping Details</h3>" +
            "  <p style='background-color: #FAF8F5; padding: 12px; border-radius: 4px; border-left: 3px solid #D36E50;'>" + address.replace("\n", "<br>") + "</p>" +
            "  <p style='margin-top: 30px; font-size: 0.9em; color: #8C8C8C;'>If you have any questions or require custom specifications, feel free to reply to this email, or call us at <strong>9361483584</strong>.</p>" +
            "</div>" +
            "</body></html>";

        try {
            System.out.println("Connecting to SMTP server " + smtpHost + ":" + smtpPort + " to notify Customer...");
            SmtpClient.sendEmail(smtpHost, smtpPort, senderEmail, senderPass, email, customerSubject, customerEmailBody);
            System.out.println("Order email successfully sent to Customer: " + email);
        } catch (Exception e) {
            System.err.println("SMTP Error sending email to Customer: " + e.getMessage());
        }
    }

    /**
     * Native Socket-based SMTP mail sender ( STARTTLS & SSL support )
     */
    static class SmtpClient {
        public static void sendEmail(String host, int port, String sender, String password, String receiver, String subject, String bodyHtml) throws Exception {
            Socket socket = new Socket(host, port);
            BufferedReader reader = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8));
            BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(socket.getOutputStream(), StandardCharsets.UTF_8));

            readResponse(reader, "220");

            // Say Hello
            sendLine(writer, "EHLO localhost");
            readResponse(reader, "250");

            // Handle STARTTLS
            if (port == 587) {
                sendLine(writer, "STARTTLS");
                readResponse(reader, "220");

                // Upgrade socket to SSL
                SSLSocketFactory sslSocketFactory = (SSLSocketFactory) SSLSocketFactory.getDefault();
                SSLSocket sslSocket = (SSLSocket) sslSocketFactory.createSocket(socket, host, port, true);
                sslSocket.startHandshake();
                socket = sslSocket;
                reader = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8));
                writer = new BufferedWriter(new OutputStreamWriter(socket.getOutputStream(), StandardCharsets.UTF_8));

                // Say Hello again over secure tunnel
                sendLine(writer, "EHLO localhost");
                readResponse(reader, "250");
            }

            // Authentication
            sendLine(writer, "AUTH LOGIN");
            readResponse(reader, "334");

            sendLine(writer, Base64.getEncoder().encodeToString(sender.getBytes(StandardCharsets.UTF_8)));
            readResponse(reader, "334");

            sendLine(writer, Base64.getEncoder().encodeToString(password.getBytes(StandardCharsets.UTF_8)));
            readResponse(reader, "235");

            // Mail Transaction
            sendLine(writer, "MAIL FROM:<" + sender + ">");
            readResponse(reader, "250");

            sendLine(writer, "RCPT TO:<" + receiver + ">");
            readResponse(reader, "250");

            sendLine(writer, "DATA");
            readResponse(reader, "354");

            // Send raw email data block
            writer.write("From: " + sender + "\r\n");
            writer.write("To: " + receiver + "\r\n");
            writer.write("Subject: " + subject + "\r\n");
            writer.write("MIME-Version: 1.0\r\n");
            writer.write("Content-Type: text/html; charset=UTF-8\r\n");
            writer.write("\r\n");
            writer.write(bodyHtml);
            writer.write("\r\n.\r\n");
            writer.flush();

            readResponse(reader, "250");

            // Finish
            sendLine(writer, "QUIT");
            socket.close();
        }

        private static void sendLine(BufferedWriter writer, String line) throws IOException {
            writer.write(line + "\r\n");
            writer.flush();
        }

        private static void readResponse(BufferedReader reader, String expectedCode) throws IOException {
            String line;
            while ((line = reader.readLine()) != null) {
                // If it is the final code line (starts with code followed by a space)
                if (line.startsWith(expectedCode)) {
                    if (line.length() >= 4 && line.charAt(3) != '-') {
                        return;
                    }
                } else if (line.length() >= 3 && !line.substring(0, 3).equals(expectedCode) && line.charAt(3) != '-') {
                    throw new IOException("SMTP Protocol Error: expected " + expectedCode + " but got line: " + line);
                }
            }
        }
    }

    private static final Object USER_LOCK = new Object();

    static class AuthRegisterHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
            exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Test-Mode");
            exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "POST, OPTIONS");

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                if (isRateLimited(exchange)) {
                    sendError(exchange, 429, "Too Many Requests. Rate limit exceeded.");
                    return;
                }

                try {
                    String jsonBody = readRequestBody(exchange);
                    String email = sanitizeInput(getJsonValue(jsonBody, "email")).trim().toLowerCase();
                    String password = getJsonValue(jsonBody, "password");

                    if (email.isEmpty() || password.isEmpty()) {
                        sendError(exchange, 400, "Missing email or password");
                        return;
                    }

                    if (!email.matches("^[^@]+@[^@]+\\.[^@]+$")) {
                        sendError(exchange, 400, "Invalid email address format");
                        return;
                    }

                    if (password.length() < 6) {
                        sendError(exchange, 400, "Password must be at least 6 characters long");
                        return;
                    }

                    boolean alreadyRegistered = false;
                    synchronized (USER_LOCK) {
                        Path path = Paths.get(DATA_DIR, "users.json");
                        if (Files.exists(path)) {
                            String content = new String(Files.readAllBytes(path), StandardCharsets.UTF_8);
                            List<String> userBlocks = parseJsonArray(content);
                            for (String block : userBlocks) {
                                String userEmail = getJsonValue(block, "email").trim().toLowerCase();
                                boolean verified = "true".equalsIgnoreCase(getJsonValue(block, "verified"));
                                if (email.equals(userEmail) && verified) {
                                    alreadyRegistered = true;
                                    break;
                                }
                            }
                        }
                    }

                    if (alreadyRegistered) {
                        sendError(exchange, 400, "Email is already registered");
                        return;
                    }

                    String otpCode = String.valueOf((int)(100000 + Math.random() * 900000));
                    OTPS.put(email, new OtpInfo(otpCode, hashPassword(password), System.currentTimeMillis() + 600000, false));

                    System.out.println("\n================================================================================");
                    System.out.println("  [SIMULATED SMTP EMAIL TO CUSTOMER (Event: OTP REGISTRATION)] (Server.java)");
                    System.out.println("  From: security@saisankalp.in");
                    System.out.println("  To: " + email);
                    System.out.println("  Subject: Verify Your Sai Sankalp Account - OTP: " + otpCode);
                    System.out.println("  ----------------------------------------------------------------------");
                    System.out.println("  Dear Customer,");
                    System.out.println("\n  Thank you for registering at Sai Sankalp Crafts!");
                    System.out.println("  Your One-Time Verification Code (OTP) is: " + otpCode);
                    System.out.println("  This code is valid for 10 minutes.");
                    System.out.println("\n  If you did not request this code, please ignore this email.");
                    System.out.println("================================================================================\n");

                    String response = "{\"status\":\"success\",\"message\":\"Verification OTP sent to email.\"}";
                    byte[] responseBytes = response.getBytes(StandardCharsets.UTF_8);
                    exchange.sendResponseHeaders(200, responseBytes.length);
                    try (OutputStream os = exchange.getResponseBody()) {
                        os.write(responseBytes);
                    }
                } catch (Exception e) {
                    sendError(exchange, 500, e.getMessage());
                }
            } else {
                sendError(exchange, 405, "Method Not Allowed");
            }
        }
    }

    static class AuthVerifyOtpHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
            exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Test-Mode");
            exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "POST, OPTIONS");

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                if (isRateLimited(exchange)) {
                    sendError(exchange, 429, "Too Many Requests. Rate limit exceeded.");
                    return;
                }

                try {
                    String jsonBody = readRequestBody(exchange);
                    String email = sanitizeInput(getJsonValue(jsonBody, "email")).trim().toLowerCase();
                    String otp = sanitizeInput(getJsonValue(jsonBody, "otp")).trim();

                    if (email.isEmpty() || otp.isEmpty()) {
                        sendError(exchange, 400, "Missing email or OTP");
                        return;
                    }

                    OtpInfo otpRecord = OTPS.get(email);
                    if (otpRecord == null || !otpRecord.code.equals(otp)) {
                        sendError(exchange, 400, "Invalid OTP code");
                        return;
                    }

                    if (System.currentTimeMillis() > otpRecord.expires) {
                        OTPS.remove(email);
                        sendError(exchange, 400, "OTP has expired");
                        return;
                    }

                    synchronized (USER_LOCK) {
                        Path path = Paths.get(DATA_DIR, "users.json");
                        String content = Files.exists(path) ? new String(Files.readAllBytes(path), StandardCharsets.UTF_8) : "[]";
                        List<String> userBlocks = parseJsonArray(content);
                        List<String> updatedBlocks = new java.util.ArrayList<>();
                        boolean userUpdated = false;

                        String role = (email.equals("saisameermarla@gmail.com") || email.equals("saisameermaral@gmail.com")) ? "admin" : "customer";

                        for (String block : userBlocks) {
                            String userEmail = getJsonValue(block, "email").trim().toLowerCase();
                            if (email.equals(userEmail)) {
                                String updatedBlock = "{\n" +
                                    "    \"email\": \"" + email + "\",\n" +
                                    "    \"passwordHash\": \"" + otpRecord.passwordHash + "\",\n" +
                                    "    \"verified\": true,\n" +
                                    "    \"role\": \"" + role + "\"\n" +
                                    "  }";
                                updatedBlocks.add(updatedBlock);
                                userUpdated = true;
                            } else {
                                updatedBlocks.add(block);
                            }
                        }

                        if (!userUpdated) {
                            String newBlock = "{\n" +
                                "    \"email\": \"" + email + "\",\n" +
                                "    \"passwordHash\": \"" + otpRecord.passwordHash + "\",\n" +
                                "    \"verified\": true,\n" +
                                "    \"role\": \"" + role + "\"\n" +
                                "  }";
                            updatedBlocks.add(newBlock);
                        }

                        StringBuilder sb = new StringBuilder();
                        sb.append("[\n");
                        for (int i = 0; i < updatedBlocks.size(); i++) {
                            sb.append("  ").append(updatedBlocks.get(i));
                            if (i < updatedBlocks.size() - 1) sb.append(",\n");
                        }
                        sb.append("\n]");
                        Files.write(path, sb.toString().getBytes(StandardCharsets.UTF_8));
                    }

                    OTPS.remove(email);

                    String response = "{\"status\":\"success\",\"message\":\"Account successfully verified.\"}";
                    byte[] responseBytes = response.getBytes(StandardCharsets.UTF_8);
                    exchange.sendResponseHeaders(200, responseBytes.length);
                    try (OutputStream os = exchange.getResponseBody()) {
                        os.write(responseBytes);
                    }
                } catch (Exception e) {
                    sendError(exchange, 500, e.getMessage());
                }
            } else {
                sendError(exchange, 405, "Method Not Allowed");
            }
        }
    }

    static class AuthLoginHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
            exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Test-Mode");
            exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "POST, OPTIONS");

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                if (isRateLimited(exchange)) {
                    sendError(exchange, 429, "Too Many Requests. Rate limit exceeded.");
                    return;
                }

                try {
                    String jsonBody = readRequestBody(exchange);
                    String email = sanitizeInput(getJsonValue(jsonBody, "email")).trim().toLowerCase();
                    String password = getJsonValue(jsonBody, "password");

                    if (email.isEmpty() || password.isEmpty()) {
                        sendError(exchange, 400, "Missing email or password");
                        return;
                    }

                    String targetUserBlock = null;
                    synchronized (USER_LOCK) {
                        Path path = Paths.get(DATA_DIR, "users.json");
                        if (Files.exists(path)) {
                            String content = new String(Files.readAllBytes(path), StandardCharsets.UTF_8);
                            List<String> userBlocks = parseJsonArray(content);
                            for (String block : userBlocks) {
                                String userEmail = getJsonValue(block, "email").trim().toLowerCase();
                                if (email.equals(userEmail)) {
                                    targetUserBlock = block;
                                    break;
                                }
                            }
                        }
                    }

                    if (targetUserBlock == null) {
                        sendError(exchange, 401, "Invalid email or password");
                        return;
                    }

                    String passwordHash = getJsonValue(targetUserBlock, "passwordHash");
                    boolean verified = "true".equalsIgnoreCase(getJsonValue(targetUserBlock, "verified"));
                    String role = getJsonValue(targetUserBlock, "role");
                    if (role.isEmpty()) role = "customer";

                    boolean passwordMatches = hashPassword(password).equals(passwordHash) || hashPasswordLegacy(password).equals(passwordHash);
                    if (!passwordMatches || !verified) {
                        sendError(exchange, 401, "Invalid email/password or account not verified");
                        return;
                    }

                    String token = UUID.randomUUID().toString();
                    SESSIONS.put(token, new SessionInfo(email, role, System.currentTimeMillis() + 86400000));

                    String response = "{\"status\":\"success\",\"token\":\"" + token + "\",\"email\":\"" + email + "\",\"role\":\"" + role + "\"}";
                    byte[] responseBytes = response.getBytes(StandardCharsets.UTF_8);
                    exchange.sendResponseHeaders(200, responseBytes.length);
                    try (OutputStream os = exchange.getResponseBody()) {
                        os.write(responseBytes);
                    }
                } catch (Exception e) {
                    sendError(exchange, 500, e.getMessage());
                }
            } else {
                sendError(exchange, 405, "Method Not Allowed");
            }
        }
    }

    static class AuthForgotPasswordHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
            exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Test-Mode");
            exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "POST, OPTIONS");

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                if (isRateLimited(exchange)) {
                    sendError(exchange, 429, "Too Many Requests. Rate limit exceeded.");
                    return;
                }

                try {
                    String jsonBody = readRequestBody(exchange);
                    String email = sanitizeInput(getJsonValue(jsonBody, "email")).trim().toLowerCase();

                    if (email.isEmpty()) {
                        sendError(exchange, 400, "Missing email");
                        return;
                    }

                    boolean registered = false;
                    synchronized (USER_LOCK) {
                        Path path = Paths.get(DATA_DIR, "users.json");
                        if (Files.exists(path)) {
                            String content = new String(Files.readAllBytes(path), StandardCharsets.UTF_8);
                            List<String> userBlocks = parseJsonArray(content);
                            for (String block : userBlocks) {
                                String userEmail = getJsonValue(block, "email").trim().toLowerCase();
                                boolean verified = "true".equalsIgnoreCase(getJsonValue(block, "verified"));
                                if (email.equals(userEmail) && verified) {
                                    registered = true;
                                    break;
                                }
                            }
                        }
                    }

                    if (!registered) {
                        sendError(exchange, 400, "Email address is not registered");
                        return;
                    }

                    String otpCode = String.valueOf((int)(100000 + Math.random() * 900000));
                    OTPS.put(email, new OtpInfo(otpCode, "", System.currentTimeMillis() + 600000, true));

                    System.out.println("\n================================================================================");
                    System.out.println("  [SIMULATED SMTP EMAIL TO CUSTOMER (Event: FORGOT PASSWORD OTP)] (Server.java)");
                    System.out.println("  From: security@saisankalp.in");
                    System.out.println("  To: " + email);
                    System.out.println("  Subject: Reset Your Password - OTP: " + otpCode);
                    System.out.println("  ----------------------------------------------------------------------");
                    System.out.println("  Dear Customer,");
                    System.out.println("\n  We received a request to reset your password.");
                    System.out.println("  Your One-Time Reset Code (OTP) is: " + otpCode);
                    System.out.println("  This code is valid for 10 minutes.");
                    System.out.println("\n  If you did not request this, please ignore this email.");
                    System.out.println("================================================================================\n");

                    String response = "{\"status\":\"success\",\"message\":\"Reset OTP sent to email.\"}";
                    byte[] responseBytes = response.getBytes(StandardCharsets.UTF_8);
                    exchange.sendResponseHeaders(200, responseBytes.length);
                    try (OutputStream os = exchange.getResponseBody()) {
                        os.write(responseBytes);
                    }
                } catch (Exception e) {
                    sendError(exchange, 500, e.getMessage());
                }
            } else {
                sendError(exchange, 405, "Method Not Allowed");
            }
        }
    }

    static class AuthResetPasswordHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
            exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Test-Mode");
            exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "POST, OPTIONS");

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                if (isRateLimited(exchange)) {
                    sendError(exchange, 429, "Too Many Requests. Rate limit exceeded.");
                    return;
                }

                try {
                    String jsonBody = readRequestBody(exchange);
                    String email = sanitizeInput(getJsonValue(jsonBody, "email")).trim().toLowerCase();
                    String otp = sanitizeInput(getJsonValue(jsonBody, "otp")).trim();
                    String newPassword = getJsonValue(jsonBody, "newPassword");

                    if (email.isEmpty() || otp.isEmpty() || newPassword.isEmpty()) {
                        sendError(exchange, 400, "Missing email, OTP, or new password");
                        return;
                    }

                    if (newPassword.length() < 6) {
                        sendError(exchange, 400, "New password must be at least 6 characters long");
                        return;
                    }

                    OtpInfo otpRecord = OTPS.get(email);
                    if (otpRecord == null || !otpRecord.code.equals(otp) || !otpRecord.reset) {
                        sendError(exchange, 400, "Invalid OTP code");
                        return;
                    }

                    if (System.currentTimeMillis() > otpRecord.expires) {
                        OTPS.remove(email);
                        sendError(exchange, 400, "OTP has expired");
                        return;
                    }

                    synchronized (USER_LOCK) {
                        Path path = Paths.get(DATA_DIR, "users.json");
                        if (!Files.exists(path)) {
                            sendError(exchange, 404, "User not found");
                            return;
                        }

                        String content = new String(Files.readAllBytes(path), StandardCharsets.UTF_8);
                        List<String> userBlocks = parseJsonArray(content);
                        List<String> updatedBlocks = new java.util.ArrayList<>();
                        boolean userFound = false;

                        for (String block : userBlocks) {
                            String userEmail = getJsonValue(block, "email").trim().toLowerCase();
                            if (email.equals(userEmail)) {
                                String role = getJsonValue(block, "role");
                                if (role.isEmpty()) role = "customer";
                                String updatedBlock = "{\n" +
                                    "    \"email\": \"" + email + "\",\n" +
                                    "    \"passwordHash\": \"" + hashPassword(newPassword) + "\",\n" +
                                    "    \"verified\": true,\n" +
                                    "    \"role\": \"" + role + "\"\n" +
                                    "  }";
                                updatedBlocks.add(updatedBlock);
                                userFound = true;
                            } else {
                                updatedBlocks.add(block);
                            }
                        }

                        if (!userFound) {
                            sendError(exchange, 404, "User not found");
                            return;
                        }

                        StringBuilder sb = new StringBuilder();
                        sb.append("[\n");
                        for (int i = 0; i < updatedBlocks.size(); i++) {
                            sb.append("  ").append(updatedBlocks.get(i));
                            if (i < updatedBlocks.size() - 1) sb.append(",\n");
                        }
                        sb.append("\n]");
                        Files.write(path, sb.toString().getBytes(StandardCharsets.UTF_8));
                    }

                    OTPS.remove(email);

                    String response = "{\"status\":\"success\",\"message\":\"Password reset successful.\"}";
                    byte[] responseBytes = response.getBytes(StandardCharsets.UTF_8);
                    exchange.sendResponseHeaders(200, responseBytes.length);
                    try (OutputStream os = exchange.getResponseBody()) {
                        os.write(responseBytes);
                    }
                } catch (Exception e) {
                    sendError(exchange, 500, e.getMessage());
                }
            } else {
                sendError(exchange, 405, "Method Not Allowed");
            }
        }
    }
}
