import React from "react";
import { Lock, Instagram, MessageCircle } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-12 md:px-8">
        
        {/* Grid: 4 colunas (desktop), 2 (tablet), 1 (mobile) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          
          {/* Coluna 1: Logo + Central */}
          <div className="space-y-6">
            <div className="w-48 h-16 bg-gray-800 border border-dashed border-gray-600 flex items-center justify-center rounded-sm text-gray-400 font-black italic text-xl tracking-tighter">
              <span className="text-red-600">BIG</span>ofertas
            </div>
            
            <div className="space-y-2">
              <h3 className="font-bold">CENTRAL DE ATENDIMENTO</h3>
              <p className="text-sm text-gray-400">Horário de atendimento:</p>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>Segunda à sexta-feira - 09h às 18h</li>
                <li>Sábado - 09h às 13h</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-bold">CONTATO</h3>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>Email: <a href="mailto:contato@bigofertas.net" className="hover:text-red-500">contato@bigofertas.net</a></li>
                <li>WhatsApp: <a href="https://wa.me/558491347939" className="hover:text-red-500">+55 (84) 9 8134-7939</a></li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-bold">SIGA-NOS:</h3>
              <div className="flex gap-4">
                <a href="#instagram" aria-label="Instagram">
                  <Instagram className="w-6 h-6 hover:text-red-500 transition-colors" />
                </a>
                <a href="#whatsapp" aria-label="WhatsApp">
                  <MessageCircle className="w-6 h-6 hover:text-red-500 transition-colors" />
                </a>
              </div>
            </div>
          </div>

          {/* Coluna 2: Acesso Rápido */}
          <div className="space-y-4">
            <h3 className="font-bold text-lg">ACESSO RÁPIDO</h3>
            <ul className="text-sm text-gray-300 space-y-2">
              <li><a href="#" className="hover:text-red-500">Início</a></li>
              <li><a href="#" className="hover:text-red-500">Políticas de Privacidade</a></li>
              <li><a href="#" className="hover:text-red-500">Política de Reembolso e Devoluções</a></li>
              <li><a href="#" className="hover:text-red-500">Política de Envio</a></li>
              <li><a href="#" className="hover:text-red-500">Termos e Condições</a></li>
              <li><a href="#" className="hover:text-red-500">FAQ</a></li>
            </ul>
          </div>

          {/* Coluna 3: Minha Conta */}
          <div className="space-y-4">
            <h3 className="font-bold text-lg">MINHA CONTA</h3>
            <ul className="text-sm text-gray-300 space-y-2">
              <li><a href="#" className="hover:text-red-500">Minha Conta</a></li>
              <li><a href="#" className="hover:text-red-500">Histórico de Pedidos</a></li>
              <li><a href="#" className="hover:text-red-500">Endereços</a></li>
              <li><a href="#" className="hover:text-red-500">Dados de Perfil</a></li>
              <li><a href="#" className="hover:text-red-500">Meus Cupons</a></li>
            </ul>
          </div>

          {/* Coluna 4: Segurança */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 bg-gray-800 p-4 rounded-md">
              <Lock className="w-8 h-8 text-green-500" />
              <div>
                <p className="font-bold text-sm">SITE SEGURO</p>
                <p className="text-xs text-gray-400">Suas informações estão protegidas</p>
              </div>
            </div>
            
            <div className="flex gap-4">
              {/* Espaço para selos de segurança */}
            </div>
          </div>

        </div>

        {/* Separador */}
        <hr className="my-12 border-gray-700" />

        {/* Copyright */}
        <div className="text-center text-sm text-gray-500">
          <p>Copyright © BIG Ofertas 2026 Todos os direitos reservados.</p>
        </div>

      </div>
    </footer>
  );
}
