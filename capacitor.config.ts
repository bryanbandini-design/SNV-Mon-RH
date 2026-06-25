import type { CapacitorConfig } from "@capacitor/cli"

// URL de production — à changer quand le serveur est déployé
const PROD_URL = "https://mon-rh-nine.vercel.app"

// En développement local, mettre l'IP de votre Mac sur le réseau local
const DEV_URL  = "http://192.168.2.103:3003"

const isProd = process.env.NODE_ENV === "production"

const config: CapacitorConfig = {
  appId:   "com.monrh.app",
  appName: "Mon RH",
  webDir:  "out",
  server: {
    url:       isProd ? PROD_URL : DEV_URL,
    cleartext: !isProd,  // HTTP uniquement en dev — false en prod (HTTPS)
  },
  ios: {
    contentInset:       "always",
    allowsLinkPreview:  false,
    scheme:             "monrh",
  },
  android: {
    allowMixedContent: !isProd,
    captureInput:      true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor:    "#0f172a",
      showSpinner:        false,
    },
    StatusBar: {
      style:           "DARK",
      backgroundColor: "#0f172a",
    },
  },
}

export default config
