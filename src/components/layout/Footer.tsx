import React, { useState } from "react";
import { Lock, Instagram, MessageCircle, ChevronDown } from "lucide-react";

export default function Footer() {
  const [expandedAccordions, setExpandedAccordions] = useState({
    acessoRapido: false,
    minhaConta: false,
  });

  const toggleAccordion = (key: keyof typeof expandedAccordions) => {
    setExpandedAccordions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <footer className="bg-gray-800 w-full text-white">
      <div className="max-w-7xl mx-auto px-10 py-16 md:px-8 md:py-12 px-5 py-8">
        
        {/* Grid 4 colunas (desktop), 2 (tablet), 1 (mobile) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-8 gap-6">
          
          {/* Coluna 1: Logo + Central */}
          <div className="flex flex-col">
            <div className="h-20 mb-8 lg:h-20 md:h-20 flex items-center">
               <div className="w-56 h-14 bg-gray-50/10 border border-dashed border-gray-600 flex items-center justify-center rounded-sm text-gray-400 font-black italic text-2xl tracking-tighter object-contain">
                <span className="text-red-600">BIG</span>ofertas
              </div>
            </div>
            
            <h3 className="text-sm font-bold uppercase text-white mb-4 tracking-wider">
              Central de Atendimento
            </h3>
            <p className="text-sm text-gray-300 mb-2 leading-relaxed">Horário de atendimento:</p>
            <ul className="list-none space-y-2 text-sm text-gray-300 mb-6">
              <li className="leading-relaxed">Segunda à sexta-feira - 09h às 18h</li>
              <li className="leading-relaxed">Sábado - 09h às 13h</li>
            </ul>
            
            <h3 className="text-sm font-bold uppercase text-white mb-4 tracking-wider">
              Contato
            </h3>
            <ul className="list-none space-y-2 text-sm text-gray-300 mb-6">
              <li>
                Email: <a href="mailto:contato@bigofertas.net" className="text-gray-300 hover:text-red-600 transition-colors duration-200">contato@bigofertas.net</a>
              </li>
              <li>
                WhatsApp: <a href="https://wa.me/558491347939" className="text-gray-300 hover:text-red-600 transition-colors duration-200">+55 (84) 9 8134-7939</a>
              </li>
            </ul>
            
            <h3 className="text-sm font-bold uppercase text-white mb-4 tracking-wider">
              Siga-nos:
            </h3>
            <div className="flex gap-4">
              <a href="#" aria-label="Instagram" className="w-6 h-6 text-gray-300 hover:text-red-600 hover:scale-110 transition-all duration-200">
                <Instagram className="w-6 h-6" />
              </a>
              <a href="#" aria-label="WhatsApp" className="w-6 h-6 text-gray-300 hover:text-red-600 hover:scale-110 transition-all duration-200">
                <MessageCircle className="w-6 h-6" />
              </a>
            </div>
          </div>

          {/* Coluna 2: Acesso Rápido Accordion */}
          <div className="flex flex-col lg:col-span-1 md:flex-col">
            <div
              onClick={() => toggleAccordion('acessoRapido')}
              className="w-full flex justify-between items-center py-4 px-0 cursor-pointer lg:cursor-auto lg:py-0 lg:pb-4"
            >
              <h3 className="text-sm font-bold uppercase text-white tracking-wider">
                Acesso Rápido
              </h3>
              <ChevronDown
                className={`w-5 h-5 text-gray-300 transition-transform duration-300 lg:hidden ${
                  expandedAccordions.acessoRapido ? 'rotate-180' : ''
                }`}
              />
            </div>
            
            <ul 
              className="list-none space-y-2 text-sm text-gray-300 lg:space-y-2 lg:!max-h-none lg:!opacity-100"
              style={{
                maxHeight: expandedAccordions.acessoRapido ? '500px' : '0px',
                opacity: expandedAccordions.acessoRapido ? 1 : 0,
                transitionProperty: 'all',
                transitionDuration: '300ms',
                transitionTimingFunction: 'ease-in-out',
                overflow: 'hidden',
              }}
            >
              <li><a href="#" className="text-gray-300 hover:text-red-600 hover:underline transition-colors duration-200">Início</a></li>
              <li><a href="#" className="text-gray-300 hover:text-red-600 hover:underline transition-colors duration-200">Políticas de Privacidade</a></li>
              <li><a href="#" className="text-gray-300 hover:text-red-600 hover:underline transition-colors duration-200">Política de Reembolso e Devoluções</a></li>
              <li><a href="#" className="text-gray-300 hover:text-red-600 hover:underline transition-colors duration-200">Política de Envio</a></li>
              <li><a href="#" className="text-gray-300 hover:text-red-600 hover:underline transition-colors duration-200">Termos e Condições</a></li>
              <li><a href="#" className="text-gray-300 hover:text-red-600 hover:underline transition-colors duration-200">FAQ</a></li>
            </ul>
          </div>

          {/* Coluna 3: Minha Conta Accordion */}
          <div className="flex flex-col lg:col-span-1 md:flex-col">
            <div
              onClick={() => toggleAccordion('minhaConta')}
              className="w-full flex justify-between items-center py-4 px-0 cursor-pointer lg:cursor-auto lg:py-0 lg:pb-4"
            >
              <h3 className="text-sm font-bold uppercase text-white tracking-wider">
                Minha Conta
              </h3>
              <ChevronDown
                className={`w-5 h-5 text-gray-300 transition-transform duration-300 lg:hidden ${
                  expandedAccordions.minhaConta ? 'rotate-180' : ''
                }`}
              />
            </div>
            
            <ul 
              className="list-none space-y-2 text-sm text-gray-300 lg:space-y-2 lg:!max-h-none lg:!opacity-100"
              style={{
                maxHeight: expandedAccordions.minhaConta ? '500px' : '0px',
                opacity: expandedAccordions.minhaConta ? 1 : 0,
                transitionProperty: 'all',
                transitionDuration: '300ms',
                transitionTimingFunction: 'ease-in-out',
                overflow: 'hidden',
              }}
            >
              <li><a href="#" className="text-gray-300 hover:text-red-600 hover:underline transition-colors duration-200">Minha Conta</a></li>
              <li><a href="#" className="text-gray-300 hover:text-red-600 hover:underline transition-colors duration-200">Histórico de Pedidos</a></li>
              <li><a href="#" className="text-gray-300 hover:text-red-600 hover:underline transition-colors duration-200">Endereços</a></li>
              <li><a href="#" className="text-gray-300 hover:text-red-600 hover:underline transition-colors duration-200">Dados de Perfil</a></li>
              <li><a href="#" className="text-gray-300 hover:text-red-600 hover:underline transition-colors duration-200">Meus Cupons</a></li>
            </ul>
          </div>

          {/* Coluna 4: Segurança */}
          <div className="flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <Lock className="w-6 h-6 text-white" />
              <div>
                <p className="text-xs font-bold text-white uppercase">SITE SEGURO</p>
                <p className="text-xs text-gray-400">Informações protegidas</p>
              </div>
            </div>
            
            <div className="flex flex-col gap-4">
              {/* SSL Badge / Seals */}
            </div>
          </div>

        </div>

        {/* Separador */}
        <hr className="border-t border-gray-700 my-8 md:my-6 my-4" />

        {/* Copyright */}
        <div className="text-center text-sm text-gray-400 py-6 md:py-4">
          <p>Copyright © BIG Ofertas 2026 Todos os direitos reservados.</p>
        </div>

      </div>
    </footer>
  );
}
