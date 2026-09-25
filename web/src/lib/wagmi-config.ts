import { createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { jaw } from "@jaw.id/wagmi";

// ReleaseKey — user-side wallet.
// Passkey-authenticated smart account (JAW), Sepolia testnet only for this demo.
export const config = createConfig({
  chains: [sepolia],
  connectors: [
    jaw({
      apiKey: process.env.NEXT_PUBLIC_JAW_API_KEY ?? "",
      appName: "ReleaseKey",
      defaultChainId: sepolia.id,
      preference: {
        showTestnets: true,
      },
    }),
  ],
  transports: {
    [sepolia.id]: http(),
  },
});
