import { Kalam, Poppins } from "next/font/google";

// Same fonts as the app: Poppins for the "Board" wordmark, Kalam for
// sticky notes and text on the canvas.
export const logoFont = Poppins({
  subsets: ["latin"],
  weight: ["600"],
});

export const handFont = Kalam({
  subsets: ["latin"],
  weight: ["400"],
});
