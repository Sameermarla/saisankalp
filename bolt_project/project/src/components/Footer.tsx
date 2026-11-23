import { Facebook, Instagram, Twitter, Mail, Phone, MapPin } from 'lucide-react';
import { useRouter } from '@/context/RouterContext';

export default function Footer() {
  const { navigate } = useRouter();

  return (
    <footer className="bg-gray-900 text-gray-300 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="Sai Sankalp" className="w-10 h-10 rounded-full object-cover" />
              <div>
                <div className="font-serif text-lg font-bold text-white">Sai Sankalp</div>
                <div className="text-[10px] text-amber-400 tracking-wider uppercase">Handicrafts of India</div>
              </div>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Bringing you authentic handcrafted treasures from artisans across India. Every purchase supports a craftsperson's livelihood.
            </p>
            <div className="flex gap-3">
              <a href="#" aria-label="Facebook" className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center hover:bg-amber-600 transition-colors">
                <Facebook className="w-4 h-4" />
              </a>
              <a href="#" aria-label="Instagram" className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center hover:bg-amber-600 transition-colors">
                <Instagram className="w-4 h-4" />
              </a>
              <a href="#" aria-label="Twitter" className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center hover:bg-amber-600 transition-colors">
                <Twitter className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Shop */}
          <div>
            <h3 className="font-semibold text-white text-sm uppercase tracking-wider mb-4">Shop</h3>
            <ul className="space-y-2 text-sm">
              <li><button onClick={() => navigate('/shop')} className="hover:text-amber-400 transition-colors">All Products</button></li>
              <li><button onClick={() => navigate('/shop?category=clay-terracotta')} className="hover:text-amber-400 transition-colors">Clay & Terracotta</button></li>
              <li><button onClick={() => navigate('/shop?category=handloom-woolens')} className="hover:text-amber-400 transition-colors">Handloom & Woolens</button></li>
              <li><button onClick={() => navigate('/shop?category=paper-crafts')} className="hover:text-amber-400 transition-colors">Handmade Paper Crafts</button></li>
              <li><button onClick={() => navigate('/shop?category=brass-metal')} className="hover:text-amber-400 transition-colors">Brass & Metal Sculptures</button></li>
              <li><button onClick={() => navigate('/shop?category=wood-decor')} className="hover:text-amber-400 transition-colors">Wood Carvings & Decor</button></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-semibold text-white text-sm uppercase tracking-wider mb-4">Support</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-amber-400 transition-colors">Shipping & Returns</a></li>
              <li><a href="#" className="hover:text-amber-400 transition-colors">FAQs</a></li>
              <li><a href="#" className="hover:text-amber-400 transition-colors">Track Your Order</a></li>
              <li><a href="#" className="hover:text-amber-400 transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-amber-400 transition-colors">Terms of Service</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold text-white text-sm uppercase tracking-wider mb-4">Contact Us</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <span>123 Crafts Lane, Jaipur, Rajasthan 302001, India</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>+91 98765 43210</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>support@saisankalp.in</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-10 pt-6 text-center text-xs text-gray-500">
          <span>© 2026 Sai Sankalp. All rights reserved. Crafted with care in India.</span>
          <span className="mx-2">·</span>
          <button onClick={() => navigate('/admin')} className="text-gray-500 hover:text-amber-400 transition-colors">Admin</button>
        </div>
      </div>
    </footer>
  );
}
