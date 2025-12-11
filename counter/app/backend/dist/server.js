"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const cross_fetch_1 = __importDefault(require("cross-fetch"));
const https_1 = __importDefault(require("https"));
// Polyfill fetch with IPv4 forced agent to fix Node 18+ connectivity issues
const agent = new https_1.default.Agent({ family: 4 });
global.fetch = (url, options) => (0, cross_fetch_1.default)(url, { ...options, agent });
const counter_routes_1 = require("./routes/counter.routes");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4000;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Routes
app.use("/api/counter", counter_routes_1.counterRoutes);
// Health check
app.get("/health", (req, res) => {
    res.json({ status: "OK", timestamp: new Date().toISOString() });
});
app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
    console.log(`Health check available at http://localhost:${PORT}/health`);
});
