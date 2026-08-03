'use client';

import { MessageCircle } from "lucide-react";
import UneteForm from "@/components/UneteForm";
import { useContactConfig } from "@/lib/firebase/use-contact-config";

export default function UnetePage() {
  const { whatsapp, correo } = useContactConfig();

  return (
    <div className="bg-slate-50 min-h-screen pt-12 pb-24">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="order-2 lg:order-1">
            <h1 className="text-4xl md:text-5xl text-dark mb-6">
              ¡Sé parte del <span className="text-primary">cambio!</span>
            </h1>
            <p className="text-lg text-text mb-8">
              La municipalidad no debe limitarse a administrar trámites o responder emergencias; debe construir condiciones para una vida mejor para todos los vecinos.
            </p>
            <p className="text-lg font-semibold text-dark mb-6">
              Si quieres un Chaclacayo diferente, necesitamos tus manos.
            </p>

            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-3 w-full sm:w-auto bg-[#25D366] text-white font-bold py-4 px-8 rounded-full hover:bg-[#1ebe57] transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              <MessageCircle />
              Únete al WhatsApp Oficial
            </a>

            <div className="mt-8 pt-8 border-t border-gray-200">
              <h4 className="font-bold text-dark mb-2">¿Dudas?</h4>
              <p className="text-text text-sm">
                Escríbenos directamente a{" "}
                <a href={`mailto:${correo}`} className="text-primary-dark hover:underline">
                  {correo}
                </a>
              </p>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <UneteForm />
          </div>
        </div>
      </div>
    </div>
  );
}
