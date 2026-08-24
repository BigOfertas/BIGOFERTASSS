import { createFileRoute } from "@tanstack/react-router";
import PromoBanner from "@/components/layout/PromoBanner";
import Header from "@/components/layout/Header";
import BestSellers from "@/components/home/BestSellers";
import VisualCategories from "@/components/home/VisualCategories";
import BrazilianProducts from "@/components/home/BrazilianProducts";
import BrazilianTeams from "@/components/home/BrazilianTeams";
import ShopByLeague from "@/components/home/ShopByLeague";
import FAQ from "@/components/home/FAQ";

import bannerInferiorAsset from "@/assets/promos/banner-promo-inferior.png.asset.json";
import bannerSuperiorAsset from "@/assets/promos/banner-promo-superior.png.asset.json";

/**
 * PROMPT PARA LOVABLE — ETAPA 18A (PARTE 1)
 * Footer BIGofertas: Estrutura e Conteúdo
 *
 * ================================================================================
 *
 * CONTEXTO
 *
 * Você vai criar a PARTE 1 do Footer profissional para BIGofertas.
 *
 * Esta é PARTE 1 de 2:
 * - PARTE 1 (AGORA): Estrutura HTML + Conteúdo + Responsividade base
 * - PARTE 2: Estilo Tailwind + Accordions (mobile) + Animações
 *
 * Novo componente: src/components/layout/Footer.tsx
 * Integração: src/routes/__root.tsx (abaixo de <Outlet />)
 *
 * ================================================================================
 *
 * OBJETIVO PARTE 1
 *
 * 1. Criar estrutura HTML do Footer
 * 2. 4 seções com conteúdo correto
 * 3. Grid responsivo (desktop/tablet/mobile)
 * 4. Links e elementos funcionais
 * 5. Sem estilos ainda (será feito na PARTE 2)
 *
 * ================================================================================
 *
 * ESTRUTURA COMPLETA
 *
 * ================================================================================
 *
 * SEÇÃO 1: LOGO + CENTRAL DE ATENDIMENTO
 *
 * Logo:
 * - Logo BIGofertas (marca da empresa)
 * - Alt text: "BIG Ofertas"
 * - Imagem: src/assets/logo.png (ou conforme existir)
 *
 * Título: "CENTRAL DE ATENDIMENTO"
 * Subtítulo: "Horário de atendimento:"
 * Horários:
 * - "Segunda à sexta-feira - 09h às 18h"
 * - "Sábado - 09h às 13h"
 *
 * Título: "CONTATO"
 * Contatos:
 * - Email: contato@bigofertas.net (EMAIL CORRETO!)
 * - WhatsApp: +55 (84) 9 8134-7939
 *
 * Título: "SIGA-NOS:"
 * Redes Sociais (elementos/ícones):
 * - Instagram
 * - WhatsApp
 * - (Sem Facebook/TikTok por enquanto)
 *
 * ================================================================================
 *
 * SEÇÃO 2: ACESSO RÁPIDO
 *
 * Título: "ACESSO RÁPIDO"
 * Links (6 itens):
 * 1. Início
 * 2. Políticas de Privacidade
 * 3. Política de Reembolso e Devoluções
 * 4. Política de Envio
 * 5. Termos e Condições
 * 6. FAQ
 *
 * Cada link:
 * - href: "#" (placeholder, será preenchido depois)
 * - Clicável
 * - Com hover state (será estilizado na PARTE 2)
 *
 * ================================================================================
 *
 * SEÇÃO 3: MINHA CONTA
 *
 * Título: "MINHA CONTA"
 * Links (5 itens):
 * 1. Minha Conta
 * 2. Histórico de Pedidos
 * 3. Endereços
 * 4. Dados de Perfil
 * 5. Meus Cupons
 *
 * Cada link:
 * - href: "#" (placeholder)
 * - Clicável
 * - Com hover state
 *
 * ================================================================================
 *
 * SEÇÃO 4: SEGURANÇA
 *
 * Ícone Cadeado + Texto:
 * - Ícone: LockIcon ou SVG cadeado
 * - Texto 1: "SITE SEGURO"
 * - Texto 2: "Suas informações estão protegidas"
 *
 * Selos de Segurança:
 * - Certificado SSL (ícone genérico)
 * - SEM Reclame Aqui (conforme solicitado)
 * - Pode incluir: Selo de segurança genérico, HTTPS badge
 *
 * ================================================================================
 *
 * ESTRUTURA HTML ESPERADA
 *
 * Componente: src/components/layout/Footer.tsx
 *
 * export default function Footer() {
 *   return (
 *     <footer>
 *       <div className="container">
 *         
 *         {/* Grid: 4 colunas (desktop), 2 (tablet), 1 (mobile com acordeões) *\/}
 *         <div className="grid">
 *           
 *           {/* Coluna 1: Logo + Central *\/}
 *           <div>
 *             <img src={logo} alt="BIG Ofertas" />
 *             
 *             <h3>CENTRAL DE ATENDIMENTO</h3>
 *             <p>Horário de atendimento:</p>
 *             <ul>
 *               <li>Segunda à sexta-feira - 09h às 18h</li>
 *               <li>Sábado - 09h às 13h</li>
 *             </ul>
 *             
 *             <h3>CONTATO</h3>
 *             <ul>
 *               <li>Email: <a href="mailto:contato@bigofertas.net">contato@bigofertas.net</a></li>
 *               <li>WhatsApp: <a href="https://wa.me/558491347939">+55 (84) 9 8134-7939</a></li>
 *             </ul>
 *             
 *             <h3>SIGA-NOS:</h3>
 *             <div className="social-icons">
 *               <a href="#instagram" aria-label="Instagram">
 *                 {/* Ícone Instagram *\/}
 *               </a>
 *               <a href="#whatsapp" aria-label="WhatsApp">
 *                 {/* Ícone WhatsApp *\/}
 *               </a>
 *             </div>
 *           </div>
 *
 *           {/* Coluna 2: Acesso Rápido *\/}
 *           <div>
 *             <h3>ACESSO RÁPIDO</h3>
 *             <ul>
 *               <li><a href="#">Início</a></li>
 *               <li><a href="#">Políticas de Privacidade</a></li>
 *               <li><a href="#">Política de Reembolso e Devoluções</a></li>
 *               <li><a href="#">Política de Envio</a></li>
 *               <li><a href="#">Termos e Condições</a></li>
 *               <li><a href="#">FAQ</a></li>
 *             </ul>
 *           </div>
 *
 *           {/* Coluna 3: Minha Conta *\/}
 *           <div>
 *             <h3>MINHA CONTA</h3>
 *             <ul>
 *               <li><a href="#">Minha Conta</a></li>
 *               <li><a href="#">Histórico de Pedidos</a></li>
 *               <li><a href="#">Endereços</a></li>
 *               <li><a href="#">Dados de Perfil</a></li>
 *               <li><a href="#">Meus Cupons</a></li>
 *             </ul>
 *           </div>
 *
 *           {/* Coluna 4: Segurança *\/}
 *           <div>
 *             <div className="security-badge">
 *               {/* Ícone Cadeado *\/}
 *               <p className="font-bold text-sm">SITE SEGURO</p>
 *               <p className="text-xs">Suas informações estão protegidas</p>
 *             </div>
 *             
 *             <div className="security-seals">
 *               {/* Certificado SSL *\/}
 *               {/* Sem Reclame Aqui *\/}
 *             </div>
 *           </div>
 *
 *         </div>
 *
 *         {/* Separador *\/}
 *         <hr />
 *
 *         {/* Copyright *\/}
 *         <div className="copyright">
 *           <p>Copyright © BIG Ofertas 2026 Todos os direitos reservados.</p>
 *         </div>
 *
 *       </div>
 *     </footer>
 *   );
 * }
 *
 * ================================================================================
 *
 * ESPECIFICAÇÕES HTML
 *
 * Grid Responsividade:
 * - Desktop (≥ 1024px): grid-cols-4 (4 colunas)
 * - Tablet (768px-1023px): grid-cols-2 (2 colunas)
 * - Mobile (< 768px): grid-cols-1 (1 coluna + acordeões na PARTE 2)
 *
 * Container:
 * - max-width: 7xl (container mx-auto)
 * - padding: 40px (desktop) | 30px (tablet) | 20px (mobile)
 *
 * Links:
 * - Href: "#" (será implementado depois)
 * - Email: href="mailto:contato@bigofertas.net"
 * - WhatsApp: href="https://wa.me/558491347939"
 *
 * Ícones:
 * - Instagram: Ícone simples (outline ou fill)
 * - WhatsApp: Ícone simples
 * - Cadeado (Security): Ícone LockIcon ou SVG
 *
 * Imagem Logo:
 * - Source: Logo existente do BIGofertas
 * - Altura: 120px (será responsivo na PARTE 2)
 * - Alt text: "BIG Ofertas"
 *
 * ================================================================================
 *
 * CHECKLIST ESTRUTURA
 *
 * HTML:
 * - [ ] Footer.tsx criado em src/components/layout/
 * - [ ] 4 seções estruturadas (Coluna 1, 2, 3, 4)
 * - [ ] Logo presente (img com alt text)
 * - [ ] Horários corretos (Seg-Sex 09h-18h, Sáb 09h-13h)
 * - [ ] Email correto: contato@bigofertas.net
 * - [ ] WhatsApp correto: +55 (84) 9 8134-7939
 * - [ ] 6 links Acesso Rápido presentes
 * - [ ] 5 links Minha Conta presentes
 * - [ ] Ícone cadeado para segurança
 * - [ ] Sem Reclame Aqui (conforme solicitado)
 * - [ ] Copyright com ano 2026
 *
 * Responsividade Base:
 * - [ ] Grid 4 colunas (desktop)
 * - [ ] Grid 2 colunas (tablet)
 * - [ ] Grid 1 coluna (mobile)
 * - [ ] Container com padding responsivo
 *
 * Funcionalidade:
 * - [ ] Email clicável (mailto:)
 * - [ ] WhatsApp clicável (wa.me/)
 * - [ ] Links funcionais (mesmo com href="#")
 * - [ ] Ícones renderizando
 * - [ ] Sem erros console
 *
 * ================================================================================
 *
 * RESTRIÇÕES PARTE 1
 *
 * ❌ NÃO fazer:
 * - Não incluir estilos Tailwind (será PARTE 2)
 * - Não criar accordeões (será PARTE 2)
 * - Não fazer hover effects (será PARTE 2)
 * - Não estilizar cores (será PARTE 2)
 * - Não incluir Reclame Aqui (conforme pedido)
 * - Não incluir App Store/Google Play
 *
 * ✅ FAZER:
 * - Estrutura HTML limpa e semântica
 * - Conteúdo correto (especialmente email)
 * - Grid responsivo (cols variam por breakpoint)
 * - Links e elementos funcionais
 * - Pronto para PARTE 2 (estilo)
 *
 * ================================================================================
 *
 * NOTA IMPORTANTE
 *
 * Email correto para usar em TODAS as instâncias:
 * contato@bigofertas.net
 *
 * ❌ Não: contato@bigofertas.com
 * ✅ Sim: contato@bigofertas.net
 *
 * WhatsApp (já correto):
 * +55 (84) 9 8134-7939
 *
 * ================================================================================
 *
 * APÓS PARTE 1
 *
 * Footer terá:
 * ✅ Estrutura HTML completa
 * ✅ Conteúdo correto (email, WhatsApp, horários)
 * ✅ 4 seções organizadas
 * ✅ Grid responsivo (4/2/1 colunas)
 * ✅ Links funcionais
 * ✅ Pronto para PARTE 2
 *
 * PRÓXIMA PARTE: Estilo Tailwind + Accordions (mobile) + Animações
 *
 * ================================================================================
 *
 * PRIORIDADE PARTE 1
 *
 * P1 (CRÍTICO):
 * 1. Estrutura HTML criada
 * 2. Email correto: contato@bigofertas.net
 * 3. Conteúdo completo
 * 4. Grid responsivo
 *
 * P2 (IMPORTANTE):
 * 1. Links funcionais
 * 2. Ícones presentes
 * 3. Sem erros console
 *
 * P3 (REFINAMENTO):
 * 1. Código semântico
 * 2. Comentários HTML
 *
 * ================================================================================
 *
 * IMAGENS/ASSETS NECESSÁRIOS
 *
 * Logo BIGofertas:
 * - Localização: src/assets/logo.png (ou conforme existir)
 * - Será usado na PARTE 1
 *
 * Ícones:
 * - Instagram: Pode usar lucide-react ou similar
 * - WhatsApp: Pode usar lucide-react ou similar
 * - Cadeado (LockIcon): lucide-react (LockIcon)
 * - SSL Badge: Genérico (será estilizado na PARTE 2)
 *
 * ================================================================================
 *
 * APÓS ESTA PARTE 1:
 *
 * - Estructura HTML ✅
 * - Conteúdo ✅
 * - Funcionalidade ✅
 * - Sem estilo (será PARTE 2)
 *
 * PRÓXIMO PASSO: PARTE 2 - Estilo + Accordions + Animações
 *
 * ================================================================================
 */
export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* 1. ARTE PROMOCIONAL SUPERIOR - CARROSSEL CONTÍNUO (1920x100) */}
      <PromoBanner 
        id="superior" 
        style={{ aspectRatio: '1920/100' }}
        className="max-h-[100px] max-md:!aspect-[1920/300] max-md:max-h-none"
        images={[
          bannerSuperiorAsset.url, // Slot 1
          bannerSuperiorAsset.url, // Slot 2
          bannerSuperiorAsset.url, // Slot 3
        ]}
      />

      {/* 2. HEADER PRINCIPAL (Includes CategoryNav in desktop) */}
      <Header />

      {/* 3. ARTE PROMOCIONAL INFERIOR - BANNER GRANDE (1920x550) */}
      <PromoBanner 
        id="inferior" 
        style={{ aspectRatio: '1920/550' }}
        className="max-h-[550px] max-md:!aspect-[1920/1897] max-md:max-h-none"
        images={[
          bannerInferiorAsset.url, // Slot 1
        ]}
      />

      <main className="flex-grow overflow-x-hidden">
        {/* Mais Vendidos / Lançamentos */}
        <BestSellers />

        {/* Diversifique seu Pedido (Categorias Visuais) */}
        <VisualCategories />

        {/* BANNER CLICÁVEL BRASILEIRÃO */}
        <PromoBanner 
          id="brasileirao" 
          style={{ aspectRatio: '1920/300' }}
          className="max-h-[300px] max-md:!aspect-[1920/750] max-md:max-h-none"
          href="/brasileirao"
          images={[
            "", // PNG Slot: Brasileirão
          ]}
        />

        {/* TIMES BRASILEIROS */}
        <BrazilianTeams />

        {/* PRODUTOS DO BRASILEIRÃO */}
        <BrazilianProducts />

        {/* COMPRE POR LIGA */}
        <ShopByLeague />

        {/* FAQ */}
        <FAQ />
      </main>

    </div>
  );
}
