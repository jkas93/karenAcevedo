import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="pt-[72px] flex flex-col min-h-screen">
      <Navbar />
      <div className="flex-grow">{children}</div>
      <Footer />
    </div>
  );
}
