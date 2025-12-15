import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            "/.netlify/functions": {
                target: "https://badseedtoken.netlify.app",
                changeOrigin: true,
                secure: false
            },
            "/solana-rpc": {
                target: "https://api.mainnet-beta.solana.com",
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/solana-rpc/, ""),
                secure: true,
                headers: {
                    "Origin": "https://explorer.solana.com",
                    "Referer": "https://explorer.solana.com"
                }
            }
        }
    }
});
