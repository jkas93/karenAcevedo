"use client";

import { useState, useEffect } from "react";
import UneteForm from "./UneteForm";
import { X } from "lucide-react";

export default function UneteModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleHashChange = () => {
      setIsOpen(window.location.hash === "#unete");
    };

    // Check initial hash
    handleHashChange();

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  if (!isOpen) return null;

  const closeModal = () => {
    window.history.back(); // Or just change hash to '#'
    // Better yet:
    window.location.hash = "";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg my-auto animate-in zoom-in-95 duration-200">
        <button 
          onClick={closeModal}
          className="absolute -top-12 right-0 md:-right-12 text-white hover:text-gray-300 transition-colors bg-black/40 rounded-full p-2"
          aria-label="Cerrar"
        >
          <X size={28} />
        </button>
        <UneteForm />
      </div>
    </div>
  );
}
