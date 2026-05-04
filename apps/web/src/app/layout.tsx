import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { AuthProvider } from "@/providers/AuthProvider";
import { ModuleProvider } from "@/providers/ModuleProvider";
import { AppDialogProvider } from "@/providers/AppDialogProvider";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "English Center CRM",
  description: "Hệ thống quản lý trung tâm tiếng Anh đa cơ sở",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className={`${inter.variable} antialiased font-body transition-colors duration-300`}>
        <ThemeProvider>
          <AuthProvider>
            <ModuleProvider>
              <AppDialogProvider>
                {children}
              </AppDialogProvider>
            </ModuleProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
