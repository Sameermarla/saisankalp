import os
import sys
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.backends.backend_pdf import PdfPages

# ---------------------------------------------------------
# GLOBAL DESIGN SYSTEM & PALETTE
# ---------------------------------------------------------
COLOR_PRIMARY_DARK  = "#0F172A"     # Slate 900
COLOR_HEADER_BG     = "#1E293B"     # Slate 800
COLOR_ACCENT_BLUE   = "#2563EB"     # Royal Blue
COLOR_ACCENT_CYAN   = "#0284C7"     # Sky Blue
COLOR_ACCENT_TEAL   = "#0D9488"     # Teal
COLOR_ACCENT_AMBER  = "#D97706"     # Amber
COLOR_ACCENT_ROSE   = "#E11D48"     # Rose Red
COLOR_ACCENT_GREEN  = "#16A34A"     # Emerald Green
COLOR_ACCENT_PURPLE = "#7C3AED"     # Violet

COLOR_BOX_BG        = "#FFFFFF"     # Crisp White
COLOR_BOX_HEADER    = "#F1F5F9"     # Slate 100
COLOR_BOX_BORDER    = "#64748B"     # Slate 500
COLOR_TEXT_MAIN     = "#0F172A"     # Slate 900
COLOR_TEXT_MUTED    = "#475569"     # Slate 600

def create_base_canvas():
    """Creates a standard 11.69 x 8.27 inch landscape canvas (A4)."""
    fig, ax = plt.subplots(figsize=(11.69, 8.27), dpi=300)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 70)
    ax.axis('off')
    return fig, ax

def draw_header(ax, num_str, title, subtitle):
    # Top decorative colored bar
    accent_bar = patches.Rectangle((0, 69.3), 100, 0.7, facecolor=COLOR_ACCENT_BLUE, edgecolor='none', zorder=10)
    ax.add_patch(accent_bar)
    
    # Header card container
    header_box = patches.FancyBboxPatch((2, 62.5), 96, 6.2, boxstyle="round,pad=0.2,rounding_size=0.6",
                                        facecolor=COLOR_HEADER_BG, edgecolor="#334155", linewidth=1.2, zorder=5)
    ax.add_patch(header_box)
    
    # Category tag
    ax.text(3.6, 66.8, "SAI SANKALP PLATFORM ARCHITECTURE  |  TECHNICAL UML SPECIFICATION",
            fontsize=7.2, fontweight='bold', color="#93C5FD", va='center', zorder=6)
    
    # Title with diagram number
    ax.text(3.6, 64.7, f"{num_str} | {title.upper()}",
            fontsize=11.5, fontweight='bold', color="#FFFFFF", va='center', zorder=6)
    
    # Subtitle
    ax.text(3.6, 63.3, subtitle,
            fontsize=7.8, fontstyle='italic', color="#CBD5E1", va='center', zorder=6)
    
    # UML Standard badge on right
    badge = patches.FancyBboxPatch((85.5, 63.3), 11.5, 4.4, boxstyle="round,pad=0.2,rounding_size=0.4",
                                  facecolor="#0F172A", edgecolor="#38BDF8", linewidth=1.0, zorder=6)
    ax.add_patch(badge)
    ax.text(91.25, 66.0, "UML 2.5", fontsize=9.0, fontweight='bold', color="#38BDF8", ha='center', va='center', zorder=7)
    ax.text(91.25, 64.3, "ENTERPRISE SPEC", fontsize=6.2, fontweight='bold', color="#94A3B8", ha='center', va='center', zorder=7)

def draw_footer(ax, current_page, total_pages=10):
    footer_line = patches.Rectangle((2, 3.4), 96, 0.08, facecolor="#CBD5E1", edgecolor='none', zorder=5)
    ax.add_patch(footer_line)
    
    ax.text(2.5, 2.2, "Sai Sankalp E-Commerce Platform  •  System Architecture & Design Blueprint",
            fontsize=7.5, color="#64748B", fontweight='medium', va='center', zorder=6)
    ax.text(50, 2.2, "Confidential  •  Software Engineering Documentation",
            fontsize=7.5, color="#94A3B8", fontstyle='italic', ha='center', va='center', zorder=6)
    ax.text(97.5, 2.2, f"Page {current_page} of {total_pages}",
            fontsize=8.0, color="#1E293B", fontweight='bold', ha='right', va='center', zorder=6)

def draw_notes_box(ax, notes, x=2, y=4.2, w=96, h=5.2, title="KEY ARCHITECTURAL HIGHLIGHTS & CODEBASE MAPPING:"):
    box = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.2,rounding_size=0.4",
                                facecolor="#F8FAFC", edgecolor="#CBD5E1", linewidth=0.8, zorder=4)
    ax.add_patch(box)
    
    # Left vertical indicator bar
    indicator = patches.Rectangle((x, y), 0.7, h, facecolor=COLOR_ACCENT_BLUE, edgecolor='none', zorder=5)
    ax.add_patch(indicator)
    
    ax.text(x + 1.4, y + h - 0.9, title, fontsize=7.2, fontweight='bold', color=COLOR_PRIMARY_DARK, zorder=6)
    
    half = (len(notes) + 1) // 2
    for i, note in enumerate(notes[:half]):
        ax.text(x + 1.4, y + h - 2.0 - (i * 1.25), f"• {note}", fontsize=6.7, color="#334155", zorder=6)
    for i, note in enumerate(notes[half:]):
        ax.text(x + 49.0, y + h - 2.0 - (i * 1.25), f"• {note}", fontsize=6.7, color="#334155", zorder=6)

# Helper for drawing UML Class box
def draw_uml_class(ax, x, y, w, h, name, stereotype, attributes, methods, header_color="#DBEAFE", border_color="#1E40AF"):
    # Main outer rectangle
    main_box = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.1,rounding_size=0.3",
                                      facecolor="#FFFFFF", edgecolor=border_color, linewidth=1.1, zorder=4)
    ax.add_patch(main_box)
    
    # Header compartment
    header_h = 2.4
    header_box = patches.FancyBboxPatch((x, y + h - header_h), w, header_h, boxstyle="round,pad=0.1,rounding_size=0.3",
                                        facecolor=header_color, edgecolor=border_color, linewidth=1.1, zorder=5)
    ax.add_patch(header_box)
    
    if stereotype:
        ax.text(x + w/2, y + h - 0.7, f"«{stereotype}»", fontsize=6.2, fontstyle='italic', color="#475569", ha='center', zorder=6)
        ax.text(x + w/2, y + h - 1.7, name, fontsize=8.0, fontweight='bold', color=COLOR_PRIMARY_DARK, ha='center', zorder=6)
    else:
        ax.text(x + w/2, y + h - 1.3, name, fontsize=8.5, fontweight='bold', color=COLOR_PRIMARY_DARK, ha='center', zorder=6)
        
    # Divider 1 (between header and attributes)
    ax.plot([x, x + w], [y + h - header_h, y + h - header_h], color=border_color, linewidth=1.0, zorder=6)
    
    # Calculate attribute compartment height
    attr_h = 0.9 * len(attributes) + 0.4
    attr_y_start = y + h - header_h - 0.7
    for i, attr in enumerate(attributes):
        ax.text(x + 0.5, attr_y_start - (i * 0.85), attr, fontsize=6.4, color="#1E293B", fontfamily='monospace', zorder=6)
        
    # Divider 2 (between attributes and methods)
    div2_y = y + h - header_h - attr_h
    ax.plot([x, x + w], [div2_y, div2_y], color=border_color, linewidth=0.8, linestyle='-', zorder=6)
    
    # Methods compartment
    meth_y_start = div2_y - 0.7
    for j, meth in enumerate(methods):
        ax.text(x + 0.5, meth_y_start - (j * 0.85), meth, fontsize=6.4, color="#0F172A", fontfamily='monospace', zorder=6)

print("Loaded base module definitions.")
import os
import sys
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.backends.backend_pdf import PdfPages

# ---------------------------------------------------------
# GLOBAL DESIGN SYSTEM & PALETTE
# ---------------------------------------------------------
COLOR_PRIMARY_DARK  = "#0F172A"     # Slate 900
COLOR_HEADER_BG     = "#1E293B"     # Slate 800
COLOR_ACCENT_BLUE   = "#2563EB"     # Royal Blue
COLOR_ACCENT_CYAN   = "#0284C7"     # Sky Blue
COLOR_ACCENT_TEAL   = "#0D9488"     # Teal
COLOR_ACCENT_AMBER  = "#D97706"     # Amber
COLOR_ACCENT_ROSE   = "#E11D48"     # Rose Red
COLOR_ACCENT_GREEN  = "#16A34A"     # Emerald Green
COLOR_ACCENT_PURPLE = "#7C3AED"     # Violet

COLOR_BOX_BG        = "#FFFFFF"     # Crisp White
COLOR_BOX_HEADER    = "#F1F5F9"     # Slate 100
COLOR_BOX_BORDER    = "#64748B"     # Slate 500
COLOR_TEXT_MAIN     = "#0F172A"     # Slate 900
COLOR_TEXT_MUTED    = "#475569"     # Slate 600

def create_base_canvas():
    """Creates a standard 11.69 x 8.27 inch landscape canvas (A4)."""
    fig, ax = plt.subplots(figsize=(11.69, 8.27), dpi=300)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 70)
    ax.axis('off')
    return fig, ax

def draw_header(ax, num_str, title, subtitle):
    # Top decorative colored bar
    accent_bar = patches.Rectangle((0, 69.3), 100, 0.7, facecolor=COLOR_ACCENT_BLUE, edgecolor='none', zorder=10)
    ax.add_patch(accent_bar)
    
    # Header card container
    header_box = patches.FancyBboxPatch((2, 62.5), 96, 6.2, boxstyle="round,pad=0.2,rounding_size=0.6",
                                        facecolor=COLOR_HEADER_BG, edgecolor="#334155", linewidth=1.2, zorder=5)
    ax.add_patch(header_box)
    
    # Category tag
    ax.text(3.6, 66.8, "SAI SANKALP PLATFORM ARCHITECTURE  |  TECHNICAL UML SPECIFICATION",
            fontsize=7.2, fontweight='bold', color="#93C5FD", va='center', zorder=6)
    
    # Title with diagram number
    ax.text(3.6, 64.7, f"{num_str} | {title.upper()}",
            fontsize=11.5, fontweight='bold', color="#FFFFFF", va='center', zorder=6)
    
    # Subtitle
    ax.text(3.6, 63.3, subtitle,
            fontsize=7.8, fontstyle='italic', color="#CBD5E1", va='center', zorder=6)
    
    # UML Standard badge on right
    badge = patches.FancyBboxPatch((85.5, 63.3), 11.5, 4.4, boxstyle="round,pad=0.2,rounding_size=0.4",
                                  facecolor="#0F172A", edgecolor="#38BDF8", linewidth=1.0, zorder=6)
    ax.add_patch(badge)
    ax.text(91.25, 66.0, "UML 2.5", fontsize=9.0, fontweight='bold', color="#38BDF8", ha='center', va='center', zorder=7)
    ax.text(91.25, 64.3, "ENTERPRISE SPEC", fontsize=6.2, fontweight='bold', color="#94A3B8", ha='center', va='center', zorder=7)

def draw_footer(ax, current_page, total_pages=10):
    footer_line = patches.Rectangle((2, 3.4), 96, 0.08, facecolor="#CBD5E1", edgecolor='none', zorder=5)
    ax.add_patch(footer_line)
    
    ax.text(2.5, 2.2, "Sai Sankalp E-Commerce Platform  •  System Architecture & Design Blueprint",
            fontsize=7.5, color="#64748B", fontweight='medium', va='center', zorder=6)
    ax.text(50, 2.2, "Confidential  •  Software Engineering Documentation",
            fontsize=7.5, color="#94A3B8", fontstyle='italic', ha='center', va='center', zorder=6)
    ax.text(97.5, 2.2, f"Page {current_page} of {total_pages}",
            fontsize=8.0, color="#1E293B", fontweight='bold', ha='right', va='center', zorder=6)

def draw_notes_box(ax, notes, x=2, y=4.2, w=96, h=5.2, title="KEY ARCHITECTURAL HIGHLIGHTS & CODEBASE MAPPING:"):
    box = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.2,rounding_size=0.4",
                                facecolor="#F8FAFC", edgecolor="#CBD5E1", linewidth=0.8, zorder=4)
    ax.add_patch(box)
    
    # Left vertical indicator bar
    indicator = patches.Rectangle((x, y), 0.7, h, facecolor=COLOR_ACCENT_BLUE, edgecolor='none', zorder=5)
    ax.add_patch(indicator)
    
    ax.text(x + 1.4, y + h - 0.9, title, fontsize=7.2, fontweight='bold', color=COLOR_PRIMARY_DARK, zorder=6)
    
    half = (len(notes) + 1) // 2
    for i, note in enumerate(notes[:half]):
        ax.text(x + 1.4, y + h - 2.0 - (i * 1.25), f"• {note}", fontsize=6.7, color="#334155", zorder=6)
    for i, note in enumerate(notes[half:]):
        ax.text(x + 49.0, y + h - 2.0 - (i * 1.25), f"• {note}", fontsize=6.7, color="#334155", zorder=6)

# =========================================================================
# PAGE 1: COVER PAGE
# =========================================================================
def render_cover_page(pdf):
    fig, ax = create_base_canvas()
    
    # Dark luxury backdrop
    bg = patches.Rectangle((0, 0), 100, 70, facecolor="#0B132B", edgecolor='none', zorder=1)
    ax.add_patch(bg)
    
    # Top geometric accent band
    top_bar = patches.Rectangle((0, 68), 100, 2, facecolor="#1C2541", edgecolor='none', zorder=2)
    ax.add_patch(top_bar)
    stripe = patches.Rectangle((0, 67.4), 100, 0.6, facecolor=COLOR_ACCENT_BLUE, edgecolor='none', zorder=3)
    ax.add_patch(stripe)
    
    # Decorative glow card in center
    center_glow = patches.FancyBboxPatch((6, 25), 88, 38, boxstyle="round,pad=0.5,rounding_size=1.0",
                                         facecolor="#1C2541", edgecolor="#3A506B", linewidth=1.5, zorder=2)
    ax.add_patch(center_glow)
    
    # Header subtext
    ax.text(10, 58.5, "SYSTEM ARCHITECTURE & SOFTWARE ENGINEERING BLUEPRINT",
            fontsize=9.5, fontweight='bold', color="#6FFFE9", zorder=4)
    
    # Big Title
    ax.text(10, 53.5, "SAI SANKALP E-COMMERCE PLATFORM",
            fontsize=24, fontweight='bold', color="#FFFFFF", zorder=4)
    
    # Subtitle
    ax.text(10, 48.5, "Comprehensive Unified Modeling Language (UML 2.5) Diagrams & System Specifications",
            fontsize=12, fontstyle='italic', color="#E0E1DD", zorder=4)
    
    # Divider line
    div_line = patches.Rectangle((10, 45.5), 80, 0.15, facecolor="#5BC0BE", edgecolor='none', zorder=4)
    ax.add_patch(div_line)
    
    # Technical specification metadata pill grid
    meta_box = patches.FancyBboxPatch((10, 28), 80, 15, boxstyle="round,pad=0.3,rounding_size=0.5",
                                      facecolor="#0B132B", edgecolor="#3A506B", linewidth=1.0, zorder=3)
    ax.add_patch(meta_box)
    
    col1_items = [
        ("Platform Target:", "Multi-tier Responsive Web E-Commerce Application"),
        ("Primary Architecture:", "Decoupled MVC with Client-side Reactive State & REST API"),
        ("Backend Services:", "Java HTTP Server (Server.java) & Python WSGI Runtime"),
        ("Data Persistence:", "SQLite 3 (saisankalp.db) & Transactional Ledgers (orders.csv)")
    ]
    
    col2_items = [
        ("Modeling Standard:", "OMG Unified Modeling Language (UML) Version 2.5"),
        ("Payment Engines:", "Razorpay Gateway (Cards/NetBanking), UPI QR & Cash on Delivery"),
        ("Security Context:", "HMAC SHA-256 Signatures, Session RBAC, Parameterized SQL"),
        ("Document Status:", "Official Engineering Deliverable • All 8 Core Diagrams")
    ]
    
    for idx, (label, val) in enumerate(col1_items):
        ax.text(12, 40 - (idx * 3.2), label, fontsize=8, fontweight='bold', color="#6FFFE9", zorder=5)
        ax.text(28, 40 - (idx * 3.2), val, fontsize=8, color="#FFFFFF", zorder=5)
        
    for idx, (label, val) in enumerate(col2_items):
        ax.text(53, 40 - (idx * 3.2), label, fontsize=8, fontweight='bold', color="#6FFFE9", zorder=5)
        ax.text(69, 40 - (idx * 3.2), val, fontsize=8, color="#FFFFFF", zorder=5)

    # Index of Diagrams Grid at Bottom
    ax.text(6, 21.5, "DIAGRAM INDEX & ARCHITECTURAL COVERAGE:",
            fontsize=9.5, fontweight='bold', color="#6FFFE9", zorder=4)
            
    diagrams = [
        ("01", "Class Diagram", "Structural Domain Model & Relational Database Entities"),
        ("02", "Use Case Diagram", "Actor Interactions, Operational Boundaries & Business Scenarios"),
        ("03", "Sequence Diagram", "Time-ordered Checkout Pipeline & Payment Authorization"),
        ("04", "Collaboration Diagram", "Object Communication Graph & Numbered Message Exchange"),
        ("05", "Activity Diagram", "End-to-End Control Flow, Decision Logic & Fulfillment"),
        ("06", "State Chart Diagram", "Order Lifecycle Finite State Machine & Guard Transitions"),
        ("07", "Component Diagram", "Subsystem Interfaces, Service Modules & Dependencies"),
        ("08", "Deployment Diagram", "Hardware Topology, Execution Nodes & Network Protocols")
    ]
    
    for i, (num, name, desc) in enumerate(diagrams):
        row = i // 4
        col = i % 4
        x = 6 + (col * 22.3)
        y = 12.5 - (row * 7.0)
        
        card = patches.FancyBboxPatch((x, y), 21.2, 6.2, boxstyle="round,pad=0.2,rounding_size=0.4",
                                      facecolor="#1C2541", edgecolor="#3A506B", linewidth=0.8, zorder=3)
        ax.add_patch(card)
        
        # Pill for number
        pill = patches.FancyBboxPatch((x + 0.8, y + 3.8), 2.8, 1.8, boxstyle="round,pad=0.1,rounding_size=0.2",
                                      facecolor=COLOR_ACCENT_BLUE, edgecolor='none', zorder=4)
        ax.add_patch(pill)
        ax.text(x + 2.2, y + 4.7, num, fontsize=7.5, fontweight='bold', color="#FFFFFF", ha='center', va='center', zorder=5)
        
        ax.text(x + 4.2, y + 4.7, name, fontsize=8, fontweight='bold', color="#FFFFFF", va='center', zorder=4)
        ax.text(x + 0.8, y + 1.8, desc, fontsize=6.3, color="#CBD5E1", wrap=True, zorder=4)

    # Footer note
    ax.text(50, 1.8, "Sai Sankalp Platform Engineering Team  •  Generated for Academic & Architectural Review",
            fontsize=7.5, color="#5BC0BE", ha='center', va='center', zorder=4)
            
    pdf.savefig(fig)
    plt.close()

print("Cover page defined.")
# =========================================================================
# PAGE 2: DIAGRAM 1 - UML CLASS DIAGRAM
# =========================================================================
def render_class_diagram(pdf):
    fig, ax = create_base_canvas()
    
    draw_header(ax, "01", "UML CLASS DIAGRAM",
                "Domain Model, Object Attributes, Method Signatures, Multiplicities & Relational Structure")
    draw_footer(ax, 2, 10)
    
    # Define classes to render:
    # 1. User
    draw_uml_class(ax, 3.0, 39.0, 18.0, 21.0, "User", "entity",
                   ["+ id: int [PK]", "+ name: string", "+ email: string", "+ password_hash: string",
                    "+ role: string", "+ phone: string", "+ address: string", "+ created_at: DateTime"],
                   ["+ validateCredentials(): bool", "+ isAdmin(): bool", "+ updateProfile(): void", "+ toSafeJSON(): Object"],
                   header_color="#EFF6FF", border_color="#2563EB")
                   
    # 2. Category
    draw_uml_class(ax, 25.5, 43.5, 17.5, 16.5, "Category", "entity",
                   ["+ id: int [PK]", "+ slug: string", "+ name: string", "+ icon: string",
                    "+ description: string", "+ active: bool"],
                   ["+ getActiveProducts(): List", "+ getSubcategories(): List"],
                   header_color="#F0FDF4", border_color="#16A34A")

    # 3. Product
    draw_uml_class(ax, 47.5, 38.0, 20.0, 22.0, "Product", "entity",
                   ["+ id: int [PK]", "+ title: string", "+ slug: string", "+ category_id: int [FK]",
                    "+ price: double", "+ compare_price: double", "+ stock_quantity: int", "+ image_url: string",
                    "+ description: string", "+ is_featured: bool", "+ in_stock: bool"],
                   ["+ isAvailable(qty: int): bool", "+ decrementStock(qty: int): void", "+ restock(qty: int): void", "+ getDiscountPct(): float"],
                   header_color="#FEF3C7", border_color="#D97706")
                   
    # 4. CartItem
    draw_uml_class(ax, 74.0, 44.5, 18.0, 15.5, "CartItem", "client-model",
                   ["+ product_id: int", "+ title: string", "+ unit_price: double",
                    "+ quantity: int", "+ image_url: string"],
                   ["+ getItemTotal(): double", "+ increment(delta: int): void", "+ serialize(): string"],
                   header_color="#F5F3FF", border_color="#7C3AED")

    # 5. Order
    draw_uml_class(ax, 3.0, 11.5, 22.0, 25.0, "Order", "aggregate-root",
                   ["+ order_id: string [PK]", "+ user_id: int [FK]", "+ customer_name: string",
                    "+ customer_email: string", "+ customer_phone: string", "+ shipping_address: string",
                    "+ subtotal: double", "+ discount_amount: double", "+ total_amount: double",
                    "+ coupon_code: string", "+ payment_method: string", "+ payment_status: string",
                    "+ order_status: string", "+ timestamp: DateTime"],
                   ["+ addOrderItem(item: OrderItem): void", "+ markAsPaid(): void",
                    "+ advanceStatus(next: string): void", "+ calculateTotals(): void", "+ cancelOrder(): void"],
                   header_color="#EFF6FF", border_color="#1E40AF")
                   
    # 6. OrderItem
    draw_uml_class(ax, 31.0, 13.5, 18.0, 17.5, "OrderItem", "entity",
                   ["+ id: int [PK]", "+ order_id: string [FK]", "+ product_id: int [FK]",
                    "+ quantity: int", "+ unit_price: double", "+ line_total: double"],
                   ["+ calculateLineTotal(): double", "+ getProductDetails(): Product"],
                   header_color="#FFF1F2", border_color="#E11D48")

    # 7. PaymentTransaction
    draw_uml_class(ax, 54.0, 12.5, 21.0, 18.5, "PaymentTransaction", "entity",
                   ["+ transaction_id: string [PK]", "+ order_id: string [FK]", "+ gateway: string",
                    "+ gateway_order_id: string", "+ gateway_payment_id: string", "+ signature: string",
                    "+ amount: double", "+ status: string", "+ timestamp: DateTime"],
                   ["+ verifyHMACSignature(): bool", "+ markSuccess(): void", "+ initiateRefund(): bool"],
                   header_color="#ECFEFF", border_color="#0D9488")

    # 8. Coupon
    draw_uml_class(ax, 79.0, 24.5, 17.5, 17.5, "Coupon", "value-object",
                   ["+ code: string [PK]", "+ discount_type: string", "+ discount_value: double",
                    "+ min_order_value: double", "+ max_discount: double", "+ active: bool", "+ expiry_date: DateTime"],
                   ["+ isValid(cartTotal: double): bool", "+ computeDiscount(subtotal: double): double"],
                   header_color="#FDF2F8", border_color="#DB2777")

    # 9. Banner
    draw_uml_class(ax, 79.0, 11.5, 17.5, 11.0, "Banner", "entity",
                   ["+ id: int [PK]", "+ title: string", "+ subtitle: string", "+ image_url: string",
                    "+ target_url: string", "+ sort_order: int", "+ active: bool"],
                   ["+ renderHTML(): string"],
                   header_color="#F8FAFC", border_color="#64748B")

    # Connectors & Relationships
    # 1. User (1) to Order (0..*)
    ax.annotate("", xy=(12.0, 36.5), xytext=(12.0, 39.0),
                arrowprops=dict(arrowstyle="->", color="#1E40AF", lw=1.2))
    ax.text(12.8, 38.0, "1", fontsize=7.5, fontweight='bold', color="#1E40AF")
    ax.text(12.8, 36.8, "0..*", fontsize=7.5, fontweight='bold', color="#1E40AF")
    ax.text(13.2, 37.4, "places", fontsize=6.8, fontstyle='italic', color="#334155")

    # 2. Category (1) contains Product (0..*) [Aggregation: open diamond at Category]
    ax.plot([43.0, 47.5], [49.0, 49.0], color="#16A34A", lw=1.2)
    # Open diamond at (43.0, 49.0)
    diamond_agg = patches.Polygon([[43.0, 49.0], [42.0, 49.6], [41.0, 49.0], [42.0, 48.4]],
                                  closed=True, facecolor="#FFFFFF", edgecolor="#16A34A", lw=1.2, zorder=7)
    ax.add_patch(diamond_agg)
    ax.text(40.0, 49.5, "1", fontsize=7.5, fontweight='bold', color="#16A34A")
    ax.text(46.0, 49.5, "0..*", fontsize=7.5, fontweight='bold', color="#16A34A")
    ax.text(43.5, 50.0, "contains", fontsize=6.8, fontstyle='italic', color="#334155", ha='center')

    # 3. Order (1) contains OrderItem (1..*) [Composition: solid diamond at Order]
    ax.plot([25.0, 31.0], [22.0, 22.0], color="#E11D48", lw=1.2)
    diamond_comp = patches.Polygon([[25.0, 22.0], [26.0, 22.6], [27.0, 22.0], [26.0, 21.4]],
                                   closed=True, facecolor="#E11D48", edgecolor="#E11D48", lw=1.2, zorder=7)
    ax.add_patch(diamond_comp)
    ax.text(27.5, 22.5, "1", fontsize=7.5, fontweight='bold', color="#E11D48")
    ax.text(29.8, 22.5, "1..*", fontsize=7.5, fontweight='bold', color="#E11D48")
    ax.text(28.0, 21.0, "has items", fontsize=6.8, fontstyle='italic', color="#334155", ha='center')

    # 4. Product (1) referenced by OrderItem (0..*)
    ax.annotate("", xy=(52.0, 38.0), xytext=(45.0, 31.0),
                arrowprops=dict(arrowstyle="->", color="#D97706", lw=1.2, linestyle='--'))
    ax.text(52.5, 36.5, "1", fontsize=7.5, fontweight='bold', color="#D97706")
    ax.text(42.5, 31.5, "0..*", fontsize=7.5, fontweight='bold', color="#D97706")
    ax.text(49.0, 33.5, "references", fontsize=6.8, fontstyle='italic', color="#334155")

    # 5. Order (1) has PaymentTransaction (1) [Composition]
    ax.plot([25.0, 54.0], [16.0, 16.0], color="#0D9488", lw=1.2)
    diamond_pay = patches.Polygon([[25.0, 16.0], [26.0, 16.6], [27.0, 16.0], [26.0, 15.4]],
                                  closed=True, facecolor="#0D9488", edgecolor="#0D9488", lw=1.2, zorder=7)
    ax.add_patch(diamond_pay)
    ax.text(27.5, 16.5, "1", fontsize=7.5, fontweight='bold', color="#0D9488")
    ax.text(52.5, 16.5, "1", fontsize=7.5, fontweight='bold', color="#0D9488")
    ax.text(39.0, 16.5, "settled by", fontsize=6.8, fontstyle='italic', color="#334155", ha='center')

    # 6. Order (0..*) utilizes Coupon (0..1)
    ax.annotate("", xy=(79.0, 32.0), xytext=(25.0, 27.0),
                arrowprops=dict(arrowstyle="->", color="#DB2777", lw=1.2, linestyle=':'))
    ax.text(26.0, 27.8, "0..*", fontsize=7.5, fontweight='bold', color="#DB2777")
    ax.text(76.5, 32.5, "0..1", fontsize=7.5, fontweight='bold', color="#DB2777")
    ax.text(48.0, 30.5, "applies discount", fontsize=6.8, fontstyle='italic', color="#334155")

    # 7. CartItem maps to Product (Dependency)
    ax.annotate("", xy=(67.5, 48.0), xytext=(74.0, 48.0),
                arrowprops=dict(arrowstyle="->", color="#7C3AED", lw=1.2, linestyle='--'))
    ax.text(70.5, 48.7, "maps to", fontsize=6.8, fontstyle='italic', color="#7C3AED", ha='center')

    # Notes box
    notes = [
        "Relational Mapping: Maps directly to SQLite tables 'users', 'categories', 'products', 'orders', 'order_items', 'coupons', and 'banners'.",
        "Encapsulation: Stock decrementation ('decrementStock') and availability verification are guarded in atomic transactional blocks.",
        "Composite Pattern: 'Order' acts as an Aggregate Root encapsulating multiple 'OrderItem' line items and a 'PaymentTransaction'.",
        "Coupons & Pricing: 'Coupon.computeDiscount' enforces minimum order threshold thresholds and expiration date checks."
    ]
    draw_notes_box(ax, notes, x=2, y=4.2, w=96, h=5.8)
    
    pdf.savefig(fig)
    plt.close()

print("Class diagram defined.")
# Helper for drawing UML Stick Figure Actor
def draw_actor(ax, x, y, label, color="#1E293B", sublabel=""):
    # Head
    head = patches.Circle((x, y + 2.5), 0.75, facecolor="#F8FAFC", edgecolor=color, linewidth=1.3, zorder=6)
    ax.add_patch(head)
    # Body
    ax.plot([x, x], [y + 1.75, y], color=color, linewidth=1.3, zorder=6)
    # Arms
    ax.plot([x - 1.2, x + 1.2], [y + 1.1, y + 1.1], color=color, linewidth=1.3, zorder=6)
    # Left Leg
    ax.plot([x, x - 1.0], [y, y - 1.5], color=color, linewidth=1.3, zorder=6)
    # Right Leg
    ax.plot([x, x + 1.0], [y, y - 1.5], color=color, linewidth=1.3, zorder=6)
    # Label
    ax.text(x, y - 2.4, label, fontsize=7.5, fontweight='bold', color=color, ha='center', va='top', zorder=6)
    if sublabel:
        ax.text(x, y - 3.4, sublabel, fontsize=6.3, fontstyle='italic', color="#64748B", ha='center', va='top', zorder=6)

# Helper for drawing Use Case Ellipse
def draw_use_case(ax, x, y, w, h, uc_id, title, bg_color="#EFF6FF", border_color="#2563EB"):
    ellipse = patches.Ellipse((x, y), w, h, facecolor=bg_color, edgecolor=border_color, linewidth=1.1, zorder=5)
    ax.add_patch(ellipse)
    ax.text(x, y + 0.5, uc_id, fontsize=6.2, fontweight='bold', color=border_color, ha='center', va='center', zorder=6)
    ax.text(x, y - 0.4, title, fontsize=6.8, fontweight='medium', color=COLOR_PRIMARY_DARK, ha='center', va='center', zorder=6)

# =========================================================================
# PAGE 3: DIAGRAM 2 - UML USE CASE DIAGRAM
# =========================================================================
def render_use_case_diagram(pdf):
    fig, ax = create_base_canvas()
    
    draw_header(ax, "02", "UML USE CASE DIAGRAM",
                "System Operational Boundary, External Stakeholder Actors, Core Scenarios & Inclusion/Extension Dependencies")
    draw_footer(ax, 3, 10)
    
    # Draw System Boundary Container
    boundary = patches.FancyBboxPatch((17.0, 11.5), 65.5, 49.5, boxstyle="round,pad=0.3,rounding_size=0.6",
                                     facecolor="#FCFDFF", edgecolor="#64748B", linewidth=1.4, linestyle='--', zorder=3)
    ax.add_patch(boundary)
    
    # Boundary title pill
    bound_title = patches.FancyBboxPatch((20.0, 58.5), 32.0, 3.2, boxstyle="round,pad=0.1,rounding_size=0.3",
                                         facecolor="#1E293B", edgecolor="#334155", linewidth=1.0, zorder=4)
    ax.add_patch(bound_title)
    ax.text(36.0, 60.1, "SYSTEM BOUNDARY: SAI SANKALP E-COMMERCE", fontsize=7.2, fontweight='bold', color="#FFFFFF", ha='center', va='center', zorder=5)

    # Sub-boundary groupings (Visual regions inside boundary)
    # 1. Storefront Region
    reg1 = patches.FancyBboxPatch((18.5, 36.5), 31.0, 21.0, boxstyle="round,pad=0.2,rounding_size=0.4",
                                  facecolor="#F1F5F9", edgecolor="#CBD5E1", linewidth=0.8, zorder=3)
    ax.add_patch(reg1)
    ax.text(19.5, 55.8, "STOREFRONT & CATALOG BROWSING", fontsize=6.4, fontweight='bold', color="#475569", zorder=4)

    # 2. Checkout & Payment Region
    reg2 = patches.FancyBboxPatch((18.5, 13.0), 31.0, 22.0, boxstyle="round,pad=0.2,rounding_size=0.4",
                                  facecolor="#EFF6FF", edgecolor="#BFDBFE", linewidth=0.8, zorder=3)
    ax.add_patch(reg2)
    ax.text(19.5, 33.3, "CHECKOUT, PAYMENT & ORDER TRACKING", fontsize=6.4, fontweight='bold', color="#1E40AF", zorder=4)

    # 3. Administrative Region
    reg3 = patches.FancyBboxPatch((51.0, 13.0), 30.0, 44.5, boxstyle="round,pad=0.2,rounding_size=0.4",
                                  facecolor="#FEF3C7", edgecolor="#FDE68A", linewidth=0.8, zorder=3)
    ax.add_patch(reg3)
    ax.text(52.5, 55.8, "ADMINISTRATIVE & FULFILLMENT OPERATIONS", fontsize=6.4, fontweight='bold', color="#92400E", zorder=4)

    # Actors:
    # 1. Guest Visitor (Left Top)
    draw_actor(ax, 8.5, 51.0, "Guest Visitor", color="#0F172A", sublabel="«actor»")
    # 2. Registered Customer (Left Bottom)
    draw_actor(ax, 8.5, 23.0, "Registered Customer", color="#1E40AF", sublabel="«actor»")
    # Generalization arrow: Registered Customer inherits from Guest Visitor
    ax.annotate("", xy=(8.5, 45.0), xytext=(8.5, 30.0),
                arrowprops=dict(arrowstyle="-|>", color="#1E40AF", lw=1.2, mutation_scale=12))

    # 3. Store Administrator (Right Top)
    draw_actor(ax, 91.5, 50.0, "Store Admin", color="#92400E", sublabel="«actor»")
    # 4. Payment Gateway (Right Bottom)
    draw_actor(ax, 91.5, 23.0, "Razorpay / UPI", color="#0D9488", sublabel="«external system»")

    # Use Cases:
    # Storefront Use Cases
    draw_use_case(ax, 34.0, 52.5, 22.0, 3.8, "UC-01", "Browse & Filter Products", bg_color="#FFFFFF", border_color="#0284C7")
    draw_use_case(ax, 34.0, 47.5, 22.0, 3.8, "UC-02", "Search Artisan Catalog", bg_color="#FFFFFF", border_color="#0284C7")
    draw_use_case(ax, 34.0, 42.5, 22.0, 3.8, "UC-03", "Manage Shopping Cart", bg_color="#FFFFFF", border_color="#0284C7")
    draw_use_case(ax, 34.0, 37.5, 22.0, 3.8, "UC-04", "Customer Authentication", bg_color="#FFFFFF", border_color="#0284C7")

    # Checkout Use Cases
    draw_use_case(ax, 26.5, 29.5, 13.5, 3.6, "UC-05", "Apply Coupon", bg_color="#FDF2F8", border_color="#DB2777")
    draw_use_case(ax, 40.5, 27.0, 18.0, 4.0, "UC-06", "Checkout & Place Order", bg_color="#DBEAFE", border_color="#1E40AF")
    draw_use_case(ax, 34.0, 20.5, 22.0, 3.8, "UC-07", "Execute Payment (COD/UPI)", bg_color="#DCFCE7", border_color="#16A34A")
    draw_use_case(ax, 34.0, 15.2, 22.0, 3.6, "UC-08", "Track Order & Receipts", bg_color="#F8FAFC", border_color="#475569")

    # Admin Use Cases
    draw_use_case(ax, 66.0, 51.5, 24.0, 3.8, "UC-09", "Manage Products & Inventory", bg_color="#FFFFFF", border_color="#D97706")
    draw_use_case(ax, 66.0, 45.0, 24.0, 3.8, "UC-10", "Manage Categories & Banners", bg_color="#FFFFFF", border_color="#D97706")
    draw_use_case(ax, 66.0, 38.5, 24.0, 3.8, "UC-11", "Manage Coupons & Promos", bg_color="#FFFFFF", border_color="#D97706")
    draw_use_case(ax, 66.0, 32.0, 24.0, 3.8, "UC-12", "Process & Dispatch Orders", bg_color="#FFFFFF", border_color="#D97706")
    draw_use_case(ax, 66.0, 25.5, 24.0, 3.8, "UC-13", "View Analytics & Telemetry", bg_color="#FFFFFF", border_color="#D97706")
    draw_use_case(ax, 66.0, 19.0, 24.0, 3.8, "UC-14", "Verify Payment Signature", bg_color="#ECFEFF", border_color="#0D9488")

    # Connectors from Guest Visitor
    for uy in [52.5, 47.5, 42.5, 37.5]:
        ax.plot([10.5, 23.0], [51.0, uy], color="#64748B", lw=0.9, zorder=4)

    # Connectors from Registered Customer
    ax.plot([10.5, 31.5], [23.0, 27.0], color="#1E40AF", lw=1.1, zorder=4)
    ax.plot([10.5, 23.0], [23.0, 15.2], color="#1E40AF", lw=1.1, zorder=4)
    ax.plot([10.5, 23.0], [23.0, 37.5], color="#1E40AF", lw=0.9, linestyle=':', zorder=4)

    # <<extend>> relationship from UC-05 (Apply Coupon) to UC-06 (Checkout)
    ax.annotate("", xy=(36.0, 28.5), xytext=(32.0, 29.5),
                arrowprops=dict(arrowstyle="->", color="#DB2777", lw=1.0, linestyle='--'))
    ax.text(34.0, 30.2, "«extend»", fontsize=6.2, fontstyle='italic', color="#DB2777", ha='center')

    # <<include>> relationship from UC-06 (Checkout) to UC-07 (Execute Payment)
    ax.annotate("", xy=(36.5, 22.4), xytext=(39.0, 25.0),
                arrowprops=dict(arrowstyle="->", color="#16A34A", lw=1.0, linestyle='--'))
    ax.text(39.5, 23.5, "«include»", fontsize=6.2, fontstyle='italic', color="#16A34A", ha='center')

    # Connection to Payment Gateway
    ax.plot([45.0, 89.5], [20.5, 23.0], color="#0D9488", lw=1.1, zorder=4)
    ax.plot([78.0, 89.5], [19.0, 23.0], color="#0D9488", lw=1.1, zorder=4)

    # Admin connectors
    for uy in [51.5, 45.0, 38.5, 32.0, 25.5]:
        ax.plot([89.5, 78.0], [50.0, uy], color="#D97706", lw=1.0, zorder=4)

    # Notes box
    notes = [
        "Actor Specialization: 'Registered Customer' inherits from 'Guest Visitor', retaining browsing rights while adding persistent checkout.",
        "Extension Point: 'Apply Coupon' (UC-05) conditionally extends checkout flow depending on whether the user possesses a promotional voucher.",
        "Mandatory Inclusion: 'Execute Payment' (UC-07) is unconditionally included in 'Checkout & Place Order' (UC-06).",
        "External Gateway Integration: Razorpay / UPI handles third-party authorization callbacks, verified server-side via HMAC SHA-256."
    ]
    draw_notes_box(ax, notes, x=2, y=4.2, w=96, h=5.8)
    
    pdf.savefig(fig)
    plt.close()

print("Use case diagram defined.")
# =========================================================================
# PAGE 4: DIAGRAM 3 - UML SEQUENCE DIAGRAM
# =========================================================================
def render_sequence_diagram(pdf):
    fig, ax = create_base_canvas()
    
    draw_header(ax, "03", "UML SEQUENCE DIAGRAM",
                "Chronological Message Exchange Pipeline: Cart Validation, Coupon Discount, Gateway Authorization & Transaction Commit")
    draw_footer(ax, 4, 10)
    
    # Participants definition: (name, subname, x, color)
    participants = [
        ("Customer", "User Agent", 8.0, "#0F172A"),
        ("Storefront UI", "storefront.js / cart.js", 24.5, "#2563EB"),
        ("API Router", "Server.java / mock_server", 42.0, "#0D9488"),
        ("Coupon Engine", "CouponService", 58.5, "#DB2777"),
        ("Razorpay Gateway", "External API", 75.0, "#7C3AED"),
        ("Database & Ledger", "saisankalp.db / CSV", 91.5, "#D97706")
    ]
    
    y_top = 58.5
    y_bottom = 12.0
    
    # Draw participant boxes and vertical lifelines
    for name, subname, px, pcol in participants:
        # Header box
        pbox = patches.FancyBboxPatch((px - 6.5, y_top), 13.0, 3.2, boxstyle="round,pad=0.1,rounding_size=0.3",
                                      facecolor="#FFFFFF", edgecolor=pcol, linewidth=1.2, zorder=6)
        ax.add_patch(pbox)
        ax.text(px, y_top + 2.0, name, fontsize=7.2, fontweight='bold', color=pcol, ha='center', va='center', zorder=7)
        ax.text(px, y_top + 0.8, f"«{subname}»", fontsize=5.8, fontstyle='italic', color="#64748B", ha='center', va='center', zorder=7)
        
        # Dashed lifeline
        ax.plot([px, px], [y_top, y_bottom], color="#94A3B8", linestyle='--', linewidth=0.9, zorder=3)

    # Activation bars
    activations = [
        (8.0, 13.0, 56.5),    # Customer
        (24.5, 14.0, 56.0),   # Storefront
        (42.0, 15.0, 53.5),   # API Router
        (58.5, 48.0, 52.0),   # Coupon
        (75.0, 29.0, 44.0),   # Razorpay
        (91.5, 16.0, 24.0)    # DB
    ]
    for ax_x, ay_bot, ay_top in activations:
        act_box = patches.Rectangle((ax_x - 0.7, ay_bot), 1.4, ay_top - ay_bot,
                                    facecolor="#E2E8F0", edgecolor="#64748B", linewidth=0.7, zorder=4)
        ax.add_patch(act_box)

    # Sequence Messages
    # Helper to draw message line
    def draw_msg(x1, x2, y, num_str, label, is_return=False, color="#1E293B"):
        style = "--" if is_return else "-"
        arr = "<-" if (x1 > x2 and not is_return) else ("->" if not is_return else "->")
        if is_return:
            ax.annotate("", xy=(x2, y), xytext=(x1, y),
                        arrowprops=dict(arrowstyle="->", color=color, lw=1.0, linestyle='--'))
        else:
            ax.annotate("", xy=(x2, y), xytext=(x1, y),
                        arrowprops=dict(arrowstyle="-|>", color=color, lw=1.1, mutation_scale=8))
        mid_x = (x1 + x2) / 2
        ax.text(mid_x, y + 0.5, f"{num_str}. {label}", fontsize=6.2, fontweight='medium', color=color, ha='center', va='bottom', zorder=8)

    # Chronological messages
    draw_msg(8.0, 24.5, 55.5, "1", "Add to Cart & Apply Coupon 'FESTIVE10'", color="#0F172A")
    draw_msg(24.5, 42.0, 53.2, "2", "POST /api/coupons/validate {code, subtotal}", color="#2563EB")
    draw_msg(42.0, 58.5, 51.0, "3", "validate(code, subtotal)", color="#0D9488")
    draw_msg(58.5, 42.0, 49.0, "4", "{valid: true, discountAmount: 150}", is_return=True, color="#DB2777")
    draw_msg(42.0, 24.5, 47.0, "5", "HTTP 200 {discount: 150, finalTotal}", is_return=True, color="#2563EB")
    draw_msg(8.0, 24.5, 44.8, "6", "Confirm Payment Method: 'Razorpay' & Checkout", color="#0F172A")
    draw_msg(24.5, 42.0, 42.5, "7", "POST /api/payment/create-order {amount}", color="#2563EB")
    draw_msg(42.0, 75.0, 40.2, "8", "POST /v1/orders {amount: 1350}", color="#7C3AED")
    draw_msg(75.0, 42.0, 38.0, "9", "200 OK {razorpay_order_id: 'order_987'}", is_return=True, color="#7C3AED")
    draw_msg(42.0, 24.5, 36.0, "10", "{key_id, razorpay_order_id}", is_return=True, color="#2563EB")
    draw_msg(24.5, 8.0, 34.0, "11", "Render Razorpay Checkout Modal", color="#2563EB")
    draw_msg(8.0, 75.0, 31.8, "12", "Authorize UPI / Card Transaction", color="#7C3AED")
    draw_msg(75.0, 24.5, 29.5, "13", "Gateway Callback {payment_id, signature}", is_return=True, color="#7C3AED")
    draw_msg(24.5, 42.0, 27.2, "14", "POST /api/orders {orderData, paymentId, signature}", color="#2563EB")

    # Alt Frame: Atomic Order Commit
    alt_box = patches.FancyBboxPatch((35.0, 14.5), 62.0, 11.5, boxstyle="round,pad=0.2,rounding_size=0.3",
                                    facecolor="#F0FDF4", edgecolor="#16A34A", linewidth=0.9, linestyle='-.', zorder=2)
    ax.add_patch(alt_box)
    alt_tab = patches.Rectangle((35.0, 23.5), 18.0, 2.5, facecolor="#16A34A", edgecolor='none', zorder=3)
    ax.add_patch(alt_tab)
    ax.text(44.0, 24.7, "alt [Payment Signature Valid]", fontsize=6.2, fontweight='bold', color="#FFFFFF", ha='center', va='center', zorder=4)

    # Self-call for signature verification
    ax.plot([42.0, 45.0, 45.0, 42.0], [25.0, 25.0, 23.8, 23.8], color="#0D9488", lw=1.0)
    ax.text(46.0, 24.4, "15. verifySignature(HMAC_SHA256)", fontsize=6.0, color="#0D9488", va='center')

    draw_msg(42.0, 91.5, 21.5, "16", "BEGIN TX -> Check Stock Availability", color="#D97706")
    draw_msg(42.0, 91.5, 19.0, "17", "INSERT order & order_items; DECREMENT stock", color="#D97706")
    draw_msg(42.0, 91.5, 16.5, "18", "COMMIT TX & Append to orders.csv ledger", is_return=True, color="#D97706")

    draw_msg(42.0, 24.5, 14.5, "19", "HTTP 201 Created {order_id, status: 'Confirmed'}", is_return=True, color="#16A34A")
    draw_msg(24.5, 8.0, 13.0, "20", "Clear Local Cart & Render Invoice Receipt", color="#16A34A")

    # Notes box
    notes = [
        "Cryptographic Security: Razorpay signatures are verified on the backend via HMAC SHA-256 before inventory is committed.",
        "ACID Transactions: Stock decrementation and order insertion execute inside a single atomic database transaction.",
        "Dual-Persistence: The order is recorded in relational SQLite ('saisankalp.db') and appended to 'orders.csv' for audit resilience.",
        "Client State Hygiene: Upon receiving HTTP 201 Created, 'cart.js' purges localStorage cart items to prevent duplicate checkout."
    ]
    draw_notes_box(ax, notes, x=2, y=4.2, w=96, h=5.8)
    
    pdf.savefig(fig)
    plt.close()

print("Sequence diagram defined.")
# =========================================================================
# PAGE 5: DIAGRAM 4 - UML COLLABORATION DIAGRAM (COMMUNICATION DIAGRAM)
# =========================================================================
def render_collaboration_diagram(pdf):
    fig, ax = create_base_canvas()
    
    draw_header(ax, "04", "UML COLLABORATION DIAGRAM",
                "Object Communication Graph, Structural Associations & Hierarchically Numbered Message Invocations")
    draw_footer(ax, 5, 10)
    
    # Helper to draw object node
    def draw_obj_node(x, y, w, h, name, class_name, bg_color="#EFF6FF", border_color="#2563EB"):
        box = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.1,rounding_size=0.3",
                                     facecolor=bg_color, edgecolor=border_color, linewidth=1.2, zorder=5)
        ax.add_patch(box)
        ax.text(x + w/2, y + h/2 + 0.6, name, fontsize=7.5, fontweight='bold', color=COLOR_PRIMARY_DARK, ha='center', va='center', zorder=6)
        ax.text(x + w/2, y + h/2 - 0.7, f":{class_name}", fontsize=6.8, fontstyle='italic', color="#475569", ha='center', va='center', zorder=6)

    # Helper to draw link line
    def draw_link(x1, y1, x2, y2, color="#64748B"):
        ax.plot([x1, x2], [y1, y2], color=color, linewidth=1.2, zorder=3)

    # Helper to draw collaboration message
    def draw_collab_msg(x, y, num_str, text, direction_arrow="→", color="#1E293B"):
        ax.text(x, y, f"{num_str} {direction_arrow} {text}", fontsize=6.3, fontweight='medium', color=color, zorder=7)

    # Objects layout
    # 1. Customer
    draw_obj_node(4.0, 48.0, 14.0, 5.5, "c", "Customer", bg_color="#F8FAFC", border_color="#0F172A")
    # 2. StorefrontUI
    draw_obj_node(26.0, 48.0, 16.0, 5.5, "ui", "StorefrontUI", bg_color="#EFF6FF", border_color="#2563EB")
    # 3. APIRouter (Hub)
    draw_obj_node(49.0, 48.0, 16.0, 5.5, "router", "APIRouter", bg_color="#ECFEFF", border_color="#0D9488")
    # 4. CouponEngine (Top)
    draw_obj_node(49.0, 34.0, 16.0, 5.5, "coupSvc", "CouponEngine", bg_color="#FDF2F8", border_color="#DB2777")
    # 5. OrderService (Center-Right)
    draw_obj_node(72.0, 48.0, 16.0, 5.5, "ordSvc", "OrderService", bg_color="#FEF3C7", border_color="#D97706")
    # 6. PaymentGateway (Bottom-Left)
    draw_obj_node(26.0, 19.0, 16.0, 5.5, "payGateway", "RazorpayAPI", bg_color="#F5F3FF", border_color="#7C3AED")
    # 7. InventoryManager (Bottom-Center)
    draw_obj_node(49.0, 19.0, 16.0, 5.5, "invMgr", "InventoryManager", bg_color="#DCFCE7", border_color="#16A34A")
    # 8. SQLiteDB (Right-Bottom)
    draw_obj_node(72.0, 31.0, 16.0, 5.5, "db", "SQLiteDatabase", bg_color="#EFF6FF", border_color="#1E40AF")
    # 9. CSVFileLedger (Far-Right Bottom)
    draw_obj_node(72.0, 15.0, 16.0, 5.5, "auditLog", "CSVFileLedger", bg_color="#F8FAFC", border_color="#64748B")

    # Links:
    # Customer <-> StorefrontUI
    draw_link(18.0, 50.7, 26.0, 50.7)
    draw_collab_msg(18.5, 52.8, "1:", "initiateCheckout(cart)", "→", color="#0F172A")
    draw_collab_msg(18.5, 48.8, "5:", "renderConfirmation()", "←", color="#16A34A")

    # StorefrontUI <-> APIRouter
    draw_link(42.0, 50.7, 49.0, 50.7)
    draw_collab_msg(42.5, 53.0, "1.1:", "validateCoupon(code)", "→", color="#2563EB")
    draw_collab_msg(42.5, 48.8, "2:", "submitOrder(payload)", "→", color="#2563EB")
    draw_collab_msg(42.5, 47.0, "4.3:", "201 Created (Confirmed)", "←", color="#16A34A")

    # APIRouter <-> CouponEngine
    draw_link(57.0, 48.0, 57.0, 39.5)
    draw_collab_msg(58.0, 45.0, "1.1.1:", "verifyDiscountThreshold()", "↓", color="#DB2777")
    draw_collab_msg(58.0, 42.0, "1.1.2:", "return discountAmount", "↑", color="#DB2777")

    # APIRouter <-> PaymentGateway
    draw_link(49.0, 48.0, 35.0, 24.5)
    draw_collab_msg(28.0, 38.0, "2.1:", "createOrder(amount)", "↓", color="#7C3AED")
    draw_collab_msg(28.0, 35.5, "2.2:", "verifySignature(sig)", "↓", color="#7C3AED")

    # APIRouter <-> OrderService
    draw_link(65.0, 50.7, 72.0, 50.7)
    draw_collab_msg(65.5, 52.0, "3:", "processOrderData()", "→", color="#D97706")

    # OrderService <-> InventoryManager
    draw_link(73.0, 48.0, 58.0, 24.5)
    draw_collab_msg(59.5, 30.5, "3.1:", "checkStockAvailability()", "↓", color="#16A34A")
    draw_collab_msg(59.5, 28.0, "3.2:", "decrementStock(qty)", "↓", color="#16A34A")

    # OrderService <-> SQLiteDB
    draw_link(80.0, 48.0, 80.0, 36.5)
    draw_collab_msg(81.0, 44.5, "3.3:", "BEGIN TRANSACTION", "↓", color="#1E40AF")
    draw_collab_msg(81.0, 42.5, "3.4:", "INSERT order & items", "↓", color="#1E40AF")
    draw_collab_msg(81.0, 40.5, "3.5:", "COMMIT TRANSACTION", "↓", color="#1E40AF")

    # OrderService <-> CSVFileLedger
    draw_link(80.0, 31.0, 80.0, 20.5)
    draw_collab_msg(81.0, 26.5, "4.1:", "appendRow(orders.csv)", "↓", color="#64748B")
    draw_collab_msg(81.0, 24.0, "4.2:", "notifySuccessReceipt()", "↑", color="#16A34A")

    # Legend / Structural Annotation
    leg_box = patches.FancyBboxPatch((4.0, 15.0), 19.0, 26.0, boxstyle="round,pad=0.2,rounding_size=0.4",
                                     facecolor="#F1F5F9", edgecolor="#94A3B8", linewidth=0.8, zorder=3)
    ax.add_patch(leg_box)
    ax.text(5.0, 38.5, "COLLABORATION NOTATION:", fontsize=7.2, fontweight='bold', color=COLOR_PRIMARY_DARK)
    ax.text(5.0, 36.0, "• Node: [Instance] : [Class]", fontsize=6.3, color="#334155")
    ax.text(5.0, 33.5, "• Solid Links: Structural paths", fontsize=6.3, color="#334155")
    ax.text(5.0, 31.0, "• Decimal Prefixes (1.1, 1.2):", fontsize=6.3, color="#334155")
    ax.text(5.0, 29.0, "  Hierarchical nested calls", fontsize=6.0, fontstyle='italic', color="#475569")
    ax.text(5.0, 26.5, "• Directional Arrows (→, ↓):", fontsize=6.3, color="#334155")
    ax.text(5.0, 24.5, "  Message dispatch flow", fontsize=6.0, fontstyle='italic', color="#475569")
    ax.text(5.0, 22.0, "• Central Hub: APIRouter acts", fontsize=6.3, color="#334155")
    ax.text(5.0, 20.0, "  as Facade Controller", fontsize=6.0, fontstyle='italic', color="#475569")
    ax.text(5.0, 17.5, "• Dual DB & Audit sinks", fontsize=6.3, color="#334155")

    # Notes box
    notes = [
        "Equivalence with Sequence Diagram: Captures identical runtime behavior to Diagram 03 while emphasizing topological links over timeline.",
        "Facade Controller Pattern: 'APIRouter' decouples client requests from internal domain services ('OrderService', 'InventoryManager').",
        "Hierarchical Delegation: Message 1 initiates client checkout, which spawns nested validation calls 1.1 and 1.1.1 prior to order submission.",
        "Resilient Audit Logging: 'CSVFileLedger' operation 4.1 guarantees flat-file append even in scenarios of RDBMS network contention."
    ]
    draw_notes_box(ax, notes, x=2, y=4.2, w=96, h=5.8)
    
    pdf.savefig(fig)
    plt.close()

print("Collaboration diagram defined.")
# =========================================================================
# PAGE 6: DIAGRAM 5 - UML ACTIVITY DIAGRAM
# =========================================================================
def render_activity_diagram(pdf):
    fig, ax = create_base_canvas()
    
    draw_header(ax, "05", "UML ACTIVITY DIAGRAM",
                "End-to-End Business Workflow: Swimlane Responsibilities, Decision Gateways, Stock Validation & Order Fulfillment")
    draw_footer(ax, 6, 10)
    
    # Draw 3 Swimlanes
    swimlanes = [
        ("CUSTOMER / STOREFRONT UI", 3.0, 31.0, "#EFF6FF", "#BFDBFE"),
        ("SAI SANKALP CORE BACKEND", 34.0, 32.0, "#F0FDF4", "#BBF7D0"),
        ("PAYMENT GATEWAY & LOGISTICS", 66.0, 31.0, "#FEF3C7", "#FDE68A")
    ]
    
    for s_title, sx, sw, s_bg, s_border in swimlanes:
        # Background lane
        lane = patches.Rectangle((sx, 11.5), sw, 49.5, facecolor=s_bg, edgecolor=s_border, linewidth=1.0, zorder=2)
        ax.add_patch(lane)
        # Header banner
        lane_header = patches.Rectangle((sx, 58.0), sw, 3.0, facecolor=s_border, edgecolor='none', zorder=3)
        ax.add_patch(lane_header)
        ax.text(sx + sw/2, 59.5, s_title, fontsize=7.2, fontweight='bold', color=COLOR_PRIMARY_DARK, ha='center', va='center', zorder=4)

    # Activity Helpers
    def draw_act(x, y, w, h, text, bg="#FFFFFF", border="#2563EB"):
        box = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.15,rounding_size=0.4",
                                     facecolor=bg, edgecolor=border, linewidth=1.0, zorder=5)
        ax.add_patch(box)
        ax.text(x + w/2, y + h/2, text, fontsize=6.3, fontweight='medium', color=COLOR_PRIMARY_DARK, ha='center', va='center', zorder=6)

    def draw_decision(x, y, size, text):
        half = size / 2
        diamond = patches.Polygon([[x, y + half], [x + half, y], [x, y - half], [x - half, y]],
                                  closed=True, facecolor="#FEF08A", edgecolor="#CA8A04", linewidth=1.0, zorder=5)
        ax.add_patch(diamond)
        ax.text(x, y, text, fontsize=5.8, fontweight='bold', color="#854D0E", ha='center', va='center', zorder=6)

    def draw_act_arrow(x1, y1, x2, y2, label=""):
        ax.annotate("", xy=(x2, y2), xytext=(x1, y1),
                    arrowprops=dict(arrowstyle="-|>", color="#334155", lw=1.1, mutation_scale=8), zorder=7)
        if label:
            mx, my = (x1 + x2)/2, (y1 + y2)/2
            ax.text(mx + 0.5, my + 0.3, label, fontsize=5.8, fontweight='bold', color="#1E40AF", zorder=8)

    # Initial Node (Black circle)
    init_node = patches.Circle((18.5, 55.5), 0.7, facecolor="#0F172A", edgecolor="#0F172A", zorder=6)
    ax.add_patch(init_node)
    
    # 1. Browse & Add Items
    draw_act(10.5, 49.5, 16.0, 3.8, "Browse Products & Add to Cart", bg="#FFFFFF", border="#2563EB")
    draw_act_arrow(18.5, 54.8, 18.5, 53.3)

    # 2. Proceed to Checkout
    draw_act(10.5, 43.5, 16.0, 3.6, "Proceed to Checkout Screen", bg="#FFFFFF", border="#2563EB")
    draw_act_arrow(18.5, 49.5, 18.5, 47.1)

    # 3. Decision: Coupon?
    draw_decision(18.5, 39.5, 4.0, "Coupon\nCode?")
    draw_act_arrow(18.5, 43.5, 18.5, 41.5)

    # Branch Yes: Validate Coupon
    draw_act(22.5, 34.0, 10.5, 3.2, "Apply Coupon\n& Deduct", bg="#FDF2F8", border="#DB2777")
    draw_act_arrow(20.5, 39.5, 27.5, 37.2, "[Yes]")

    # Branch No: Merge at (14.0, 34.0)
    draw_act(5.0, 34.0, 11.5, 3.2, "Continue with\nStandard Total", bg="#FFFFFF", border="#64748B")
    draw_act_arrow(16.5, 39.5, 10.5, 37.2, "[No]")

    # Merge into Payment Selection
    draw_act(9.5, 27.5, 18.0, 3.6, "Select Payment Method\n(COD / Razorpay Gateway)", bg="#FFFFFF", border="#2563EB")
    draw_act_arrow(27.5, 34.0, 20.0, 31.1)
    draw_act_arrow(10.5, 34.0, 16.0, 31.1)

    # Decision: Payment Gateway vs COD
    draw_decision(18.5, 22.0, 4.0, "Pay\nMethod?")
    draw_act_arrow(18.5, 27.5, 18.5, 24.0)

    # Payment Gateway Flow (moves to Swimlane 3)
    draw_act_arrow(20.5, 22.0, 71.0, 22.0, "[Razorpay]")
    draw_act(71.0, 20.2, 21.0, 3.6, "Launch Gateway Modal\n& Authorize (UPI/Card)", bg="#FFFFFF", border="#7C3AED")

    # Gateway Decision
    draw_decision(81.5, 15.0, 3.8, "Auth\nOK?")
    draw_act_arrow(81.5, 20.2, 81.5, 16.9)

    # Auth Failed: self loop / abort
    draw_act(86.5, 13.5, 8.5, 3.0, "Payment\nFailed Alert", bg="#FFF1F2", border="#E11D48")
    draw_act_arrow(83.4, 15.0, 86.5, 15.0, "[No]")

    # Auth OK: Return to Backend
    draw_act_arrow(79.6, 15.0, 50.0, 15.0, "[Yes]")

    # COD Branch to Backend
    draw_act_arrow(18.5, 20.0, 18.5, 15.0, "[COD]")
    draw_act_arrow(18.5, 15.0, 36.0, 15.0)

    # Backend Activities:
    # 4. Stock Verification
    draw_act(36.0, 13.2, 14.0, 3.6, "Verify Stock in\nSQLite Database", bg="#FFFFFF", border="#0D9488")
    
    # Move up in Backend Lane
    draw_decision(43.0, 23.0, 4.0, "Stock\nOK?")
    draw_act_arrow(43.0, 16.8, 43.0, 21.0)

    # Stock Out: Error
    draw_act(35.5, 28.5, 12.0, 3.2, "Rollback TX &\nNotify Out of Stock", bg="#FFF1F2", border="#E11D48")
    draw_act_arrow(41.0, 23.0, 41.0, 28.5, "[No]")
    draw_act_arrow(35.5, 30.0, 20.0, 30.0) # points back to storefront alert

    # Stock Yes: Commit Order
    draw_act(48.0, 28.5, 16.5, 4.0, "Deduct Stock, Commit\nOrder & Append CSV", bg="#FFFFFF", border="#16A34A")
    draw_act_arrow(45.0, 23.0, 54.0, 28.5, "[Yes]")

    # Send Confirmation
    draw_act(48.0, 36.0, 16.5, 3.6, "Generate Invoice &\nDispatch Confirmation", bg="#DCFCE7", border="#16A34A")
    draw_act_arrow(56.2, 32.5, 56.2, 36.0)

    # Client displays confirmation
    draw_act(10.5, 36.0, 16.0, 3.4, "Display Order Success\n& Clear Cart State", bg="#F0FDF4", border="#16A34A")
    draw_act_arrow(48.0, 37.8, 26.5, 37.8)

    # Logistics Swimlane Flow (Fulfillment)
    draw_act(71.0, 36.0, 21.0, 3.6, "Warehouse Picks & Packs\nArtisan Items", bg="#FFFFFF", border="#D97706")
    draw_act_arrow(64.5, 37.8, 71.0, 37.8)

    draw_act(71.0, 43.5, 21.0, 3.6, "Generate Courier Waybill\n& Hand to Logistics", bg="#FFFFFF", border="#D97706")
    draw_act_arrow(81.5, 39.6, 81.5, 43.5)

    draw_act(71.0, 50.5, 21.0, 3.6, "Shipment Delivered to\nCustomer Address", bg="#FFFFFF", border="#16A34A")
    draw_act_arrow(81.5, 47.1, 81.5, 50.5)

    # Final Activity Node (Bullseye: Outer circle + Inner solid circle)
    final_outer = patches.Circle((81.5, 56.5), 1.0, facecolor="#FFFFFF", edgecolor="#0F172A", linewidth=1.3, zorder=6)
    final_inner = patches.Circle((81.5, 56.5), 0.6, facecolor="#0F172A", edgecolor="#0F172A", zorder=7)
    ax.add_patch(final_outer)
    ax.add_patch(final_inner)
    draw_act_arrow(81.5, 54.1, 81.5, 55.5)

    # Notes box
    notes = [
        "Partitioned Responsibility: Clarifies separation between UI client thread, server transactional domain, and logistics fulfillment.",
        "Guarded Decision Gateways: Enforces branching for coupon presence, payment mode (COD vs Razorpay), authorization result, and stock quota.",
        "Compensating Rollback: If stock verification fails after payment authorization, an automated reversal signal is triggered to avoid inconsistency.",
        "Asynchronous Logistics: Order fulfillment transitions asynchronously from 'Order Confirmation' to courier handoff and delivery."
    ]
    draw_notes_box(ax, notes, x=2, y=4.2, w=96, h=5.8)
    
    pdf.savefig(fig)
    plt.close()

print("Activity diagram defined.")
# =========================================================================
# PAGE 7: DIAGRAM 6 - UML STATE CHART DIAGRAM (STATE MACHINE)
# =========================================================================
def render_state_chart_diagram(pdf):
    fig, ax = create_base_canvas()
    
    draw_header(ax, "06", "UML STATE CHART DIAGRAM",
                "Order Entity Lifecycle: Composite States, Trigger Events, Guard Conditions & State Transition Graph")
    draw_footer(ax, 7, 10)
    
    # Helper to draw a state box
    def draw_state(x, y, w, h, name, actions=None, bg="#FFFFFF", border="#2563EB"):
        box = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.2,rounding_size=0.5",
                                     facecolor=bg, edgecolor=border, linewidth=1.1, zorder=4)
        ax.add_patch(box)
        if actions:
            # Header line
            ax.text(x + w/2, y + h - 1.2, name, fontsize=7.2, fontweight='bold', color=COLOR_PRIMARY_DARK, ha='center', va='center', zorder=5)
            ax.plot([x, x + w], [y + h - 2.0, y + h - 2.0], color=border, linewidth=0.8, zorder=5)
            for i, act in enumerate(actions):
                ax.text(x + 0.8, y + h - 2.8 - (i * 0.9), act, fontsize=5.8, color="#334155", fontfamily='monospace', zorder=5)
        else:
            ax.text(x + w/2, y + h/2, name, fontsize=7.5, fontweight='bold', color=COLOR_PRIMARY_DARK, ha='center', va='center', zorder=5)

    def draw_trans(x1, y1, x2, y2, label="", color="#1E293B", offset_y=0.4):
        ax.annotate("", xy=(x2, y2), xytext=(x1, y1),
                    arrowprops=dict(arrowstyle="-|>", color=color, lw=1.1, mutation_scale=8), zorder=6)
        if label:
            mx, my = (x1 + x2)/2, (y1 + y2)/2
            ax.text(mx, my + offset_y, label, fontsize=5.8, fontweight='medium', color=color, ha='center', va='bottom', zorder=7)

    # Initial State [*]
    init_node = patches.Circle((6.0, 50.0), 0.8, facecolor="#0F172A", edgecolor="#0F172A", zorder=6)
    ax.add_patch(init_node)

    # State 1: Draft
    draw_state(12.0, 46.5, 14.0, 7.0, "Draft (Cart)", ["entry / initCartSession()", "do / updateItemQuantities()"], bg="#EFF6FF", border="#2563EB")
    draw_trans(6.8, 50.0, 12.0, 50.0, "addItemToCart")

    # State 2: Pending Payment
    draw_state(32.0, 46.5, 15.0, 7.0, "Pending Payment", ["entry / computeFinalTotal()", "do / initializeCheckoutTimer()"], bg="#EFF6FF", border="#2563EB")
    draw_trans(26.0, 50.0, 32.0, 50.0, "clickCheckout")

    # Composite State: Payment Processing Container
    comp_box = patches.FancyBboxPatch((52.0, 39.0), 43.0, 19.5, boxstyle="round,pad=0.3,rounding_size=0.6",
                                       facecolor="#F8FAFC", edgecolor="#7C3AED", linewidth=1.2, linestyle='--', zorder=3)
    ax.add_patch(comp_box)
    ax.text(54.0, 56.8, "COMPOSITE STATE: Payment Processing & Verification", fontsize=6.8, fontweight='bold', color="#7C3AED", zorder=4)

    # Substates
    draw_state(54.5, 47.5, 16.0, 6.0, "Awaiting Callback", ["do / listenGatewayWebhook()"], bg="#FFFFFF", border="#7C3AED")
    draw_state(76.5, 47.5, 16.0, 6.0, "Signature Verified", ["entry / verifyHMACSHA256()"], bg="#FFFFFF", border="#0D9488")
    draw_state(54.5, 40.5, 16.0, 5.5, "COD Review", ["entry / flagForAdminReview()"], bg="#FFFFFF", border="#D97706")

    draw_trans(47.0, 50.0, 54.5, 50.0, "submitOrder(Online)")
    draw_trans(42.0, 46.5, 54.5, 43.5, "submitOrder(COD)")
    draw_trans(70.5, 50.5, 76.5, 50.5, "callbackSuccess")

    # State: Payment Failed
    draw_state(32.0, 31.0, 15.0, 6.5, "Payment Failed", ["entry / notifyCustomer()", "do / offerAlternativePayment()"], bg="#FFF1F2", border="#E11D48")
    draw_trans(54.5, 48.0, 47.0, 35.0, "[Payment Declined]", color="#E11D48")
    # Retry arrow
    draw_trans(35.0, 37.5, 35.0, 46.5, "retryCheckout [attempts < 3]", color="#2563EB")

    # State: Cancelled (Terminal)
    draw_state(12.0, 31.0, 14.0, 6.0, "Cancelled", ["entry / releaseStockReservation()", "exit / archiveOrder()"], bg="#F1F5F9", border="#64748B")
    draw_trans(32.0, 34.0, 26.0, 34.0, "[timeout / abort]", color="#64748B")
    
    # Terminal circle for Cancelled
    term_can = patches.Circle((6.0, 34.0), 0.9, facecolor="#FFFFFF", edgecolor="#64748B", linewidth=1.2, zorder=6)
    term_can_in = patches.Circle((6.0, 34.0), 0.5, facecolor="#64748B", edgecolor='none', zorder=7)
    ax.add_patch(term_can)
    ax.add_patch(term_can_in)
    draw_trans(12.0, 34.0, 7.0, 34.0)

    # State: Confirmed / Processing
    draw_state(76.5, 27.5, 17.5, 6.8, "Processing", ["entry / lockInventoryStock()", "do / assignWarehouseBin()"], bg="#ECFDF5", border="#16A34A")
    draw_trans(84.5, 47.5, 84.5, 34.3, "[Signature Valid]", color="#16A34A")
    draw_trans(70.5, 43.5, 76.5, 31.0, "adminApprovesCOD", color="#16A34A")

    # State: Packed
    draw_state(54.0, 27.5, 17.0, 6.8, "Packed", ["entry / generateInvoice()", "do / affixTrackingBarcode()"], bg="#FEF3C7", border="#D97706")
    draw_trans(76.5, 30.5, 71.0, 30.5, "goodsAssembled", color="#D97706")

    # State: Shipped
    draw_state(31.0, 20.0, 17.0, 6.8, "Shipped", ["entry / assignCourierWaybill()", "do / emitTrackingSMS()"], bg="#FEF3C7", border="#D97706")
    draw_trans(54.0, 29.0, 48.0, 23.5, "carrierPickup", color="#D97706")

    # State: Out for Delivery
    draw_state(54.0, 12.0, 17.0, 6.5, "Out for Delivery", ["do / localCourierRouting()"], bg="#EFF6FF", border="#2563EB")
    draw_trans(39.0, 20.0, 54.0, 15.5, "hubArrival", color="#2563EB")

    # State: Delivered (Terminal 1)
    draw_state(76.5, 12.0, 16.0, 6.5, "Delivered", ["entry / captureSignature()", "entry / triggerReviewEmail()"], bg="#DCFCE7", border="#16A34A")
    draw_trans(71.0, 15.2, 76.5, 15.2, "packageDelivered", color="#16A34A")
    
    term_del = patches.Circle((95.5, 15.2), 0.9, facecolor="#FFFFFF", edgecolor="#16A34A", linewidth=1.2, zorder=6)
    term_del_in = patches.Circle((95.5, 15.2), 0.5, facecolor="#16A34A", edgecolor='none', zorder=7)
    ax.add_patch(term_del)
    ax.add_patch(term_del_in)
    draw_trans(92.5, 15.2, 94.5, 15.2)

    # State: Return Requested & Refunded
    draw_state(12.0, 19.5, 14.0, 6.2, "Return Requested", ["entry / verifyPolicyWindow()"], bg="#FDF2F8", border="#DB2777")
    draw_trans(76.5, 17.0, 26.0, 22.0, "requestReturn [days <= 7]", color="#DB2777")

    draw_state(12.0, 12.0, 14.0, 5.5, "Refunded", ["entry / issueGatewayRefund()"], bg="#F8FAFC", border="#64748B")
    draw_trans(19.0, 19.5, 19.0, 17.5, "itemInspected", color="#DB2777")
    
    term_ref = patches.Circle((6.0, 14.7), 0.9, facecolor="#FFFFFF", edgecolor="#64748B", linewidth=1.2, zorder=6)
    term_ref_in = patches.Circle((6.0, 14.7), 0.5, facecolor="#64748B", edgecolor='none', zorder=7)
    ax.add_patch(term_ref)
    ax.add_patch(term_ref_in)
    draw_trans(12.0, 14.7, 7.0, 14.7)

    # Notes box
    notes = [
        "Composite Verification: 'Payment Processing' encapsulates parallel sub-states for Razorpay HMAC cryptographic verification vs. manual COD audit.",
        "Guarded Invariant Transitions: Return claims enforce guard condition [days <= 7] relative to delivery timestamp.",
        "Terminal Absorbing States: 'Delivered', 'Cancelled', and 'Refunded' represent terminal sinks terminating the state machine thread.",
        "State Restorations: Cancellation triggers compensating action 'releaseStockReservation()' to update SQLite inventory quantities."
    ]
    draw_notes_box(ax, notes, x=2, y=4.2, w=96, h=5.8)
    
    pdf.savefig(fig)
    plt.close()

print("State chart diagram defined.")
# =========================================================================
# PAGE 8: DIAGRAM 7 - UML COMPONENT DIAGRAM
# =========================================================================
def render_component_diagram(pdf):
    fig, ax = create_base_canvas()
    
    draw_header(ax, "07", "UML COMPONENT DIAGRAM",
                "Software Subsystems, Modular Service Components, Provided/Required Interface Ports & Dependencies")
    draw_footer(ax, 8, 10)
    
    # Helper to draw a UML Component box with standard 2 tabs
    def draw_component(x, y, w, h, name, stereotype="component", files="", bg="#FFFFFF", border="#2563EB"):
        box = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.1,rounding_size=0.3",
                                     facecolor=bg, edgecolor=border, linewidth=1.1, zorder=5)
        ax.add_patch(box)
        # Component icon in top right: small rectangle with two protruding sub-rectangles
        icon_x = x + w - 3.2
        icon_y = y + h - 2.8
        icon_box = patches.Rectangle((icon_x, icon_y), 2.4, 2.0, facecolor="#F1F5F9", edgecolor=border, linewidth=0.8, zorder=6)
        ax.add_patch(icon_box)
        tab1 = patches.Rectangle((icon_x - 0.5, icon_y + 1.2), 1.0, 0.5, facecolor="#F1F5F9", edgecolor=border, linewidth=0.7, zorder=7)
        tab2 = patches.Rectangle((icon_x - 0.5, icon_y + 0.3), 1.0, 0.5, facecolor="#F1F5F9", edgecolor=border, linewidth=0.7, zorder=7)
        ax.add_patch(tab1)
        ax.add_patch(tab2)
        
        # Labels
        ax.text(x + 1.0, y + h - 1.2, f"«{stereotype}»", fontsize=6.0, fontstyle='italic', color="#475569", zorder=6)
        ax.text(x + 1.0, y + h - 2.3, name, fontsize=7.5, fontweight='bold', color=COLOR_PRIMARY_DARK, zorder=6)
        if files:
            ax.text(x + 1.0, y + 1.0, f"Artifacts: {files}", fontsize=5.8, color="#64748B", fontfamily='monospace', zorder=6)

    # Helper for lollipop interface
    def draw_lollipop(x, y, radius, label="", direction="right"):
        circle = patches.Circle((x, y), radius, facecolor="#FFFFFF", edgecolor="#0F172A", linewidth=1.1, zorder=7)
        ax.add_patch(circle)
        if label:
            ax.text(x, y + 0.9, label, fontsize=5.8, fontweight='bold', color="#0F172A", ha='center', zorder=8)

    # 3 Main Packages / Subsystem Containers
    # Package 1: Client Presentation
    pkg1 = patches.FancyBboxPatch((3.0, 12.0), 28.5, 49.0, boxstyle="round,pad=0.2,rounding_size=0.4",
                                  facecolor="#EFF6FF", edgecolor="#BFDBFE", linewidth=1.1, zorder=2)
    ax.add_patch(pkg1)
    ax.text(4.5, 59.2, "PACKAGE: Presentation Tier (Client SPA)", fontsize=7.0, fontweight='bold', color="#1E40AF", zorder=3)

    # Package 2: Backend Application Services
    pkg2 = patches.FancyBboxPatch((34.5, 12.0), 32.5, 49.0, boxstyle="round,pad=0.2,rounding_size=0.4",
                                  facecolor="#F0FDF4", edgecolor="#BBF7D0", linewidth=1.1, zorder=2)
    ax.add_patch(pkg2)
    ax.text(36.0, 59.2, "PACKAGE: Application Services Tier (Server)", fontsize=7.0, fontweight='bold', color="#166534", zorder=3)

    # Package 3: Data Persistence Tier
    pkg3 = patches.FancyBboxPatch((70.0, 24.0), 27.0, 37.0, boxstyle="round,pad=0.2,rounding_size=0.4",
                                  facecolor="#FEF3C7", edgecolor="#FDE68A", linewidth=1.1, zorder=2)
    ax.add_patch(pkg3)
    ax.text(71.5, 59.2, "PACKAGE: Persistence Tier (Storage)", fontsize=7.0, fontweight='bold', color="#92400E", zorder=3)

    # Package 4: External Services (Bottom Right)
    pkg4 = patches.FancyBboxPatch((70.0, 12.0), 27.0, 10.5, boxstyle="round,pad=0.2,rounding_size=0.4",
                                  facecolor="#F5F3FF", edgecolor="#DDD6FE", linewidth=1.1, zorder=2)
    ax.add_patch(pkg4)
    ax.text(71.5, 20.8, "PACKAGE: Cloud Integrations", fontsize=7.0, fontweight='bold', color="#5B21B6", zorder=3)

    # Client Components
    draw_component(4.5, 48.0, 25.5, 8.5, "Storefront UI Controller", files="storefront.js, index.html", bg="#FFFFFF", border="#2563EB")
    draw_component(4.5, 37.0, 25.5, 8.5, "Cart & Checkout Engine", files="cart.js", bg="#FFFFFF", border="#2563EB")
    draw_component(4.5, 25.5, 25.5, 8.5, "Client State & Storage", files="state.js, localStorage", bg="#FFFFFF", border="#2563EB")
    draw_component(4.5, 14.0, 25.5, 8.5, "Admin Dashboard Module", files="admin.js, admin.html", bg="#FFFFFF", border="#2563EB")

    # Backend Components
    draw_component(36.0, 48.0, 29.5, 8.5, "HTTP Server & API Router", files="Server.java / mock_server.py", bg="#FFFFFF", border="#0D9488")
    draw_component(36.0, 39.5, 29.5, 7.0, "Product Catalog Service", files="ProductController, FilterEngine", bg="#FFFFFF", border="#0D9488")
    draw_component(36.0, 31.0, 29.5, 7.0, "Order Processing Service", files="OrderController, StockReducer", bg="#FFFFFF", border="#0D9488")
    draw_component(36.0, 22.5, 29.5, 7.0, "Coupon & Discount Service", files="CouponValidator", bg="#FFFFFF", border="#0D9488")
    draw_component(36.0, 14.0, 29.5, 7.0, "Authentication & RBAC", files="AuthService, SessionManager", bg="#FFFFFF", border="#0D9488")

    # Persistence Components
    draw_component(71.5, 47.5, 24.0, 8.5, "SQLite RDBMS Engine", files="saisankalp.db (Tables: 7)", bg="#FFFFFF", border="#D97706")
    draw_component(71.5, 36.5, 24.0, 8.5, "Flat File Storage Adapter", files="orders.csv, products.json", bg="#FFFFFF", border="#D97706")
    draw_component(71.5, 25.5, 24.0, 8.5, "Static Asset Provider", files="/images/*, css/*", bg="#FFFFFF", border="#D97706")

    # External Component
    draw_component(71.5, 13.0, 24.0, 6.8, "Razorpay Payment Gateway", files="REST API, Webhook Callback", bg="#FFFFFF", border="#7C3AED")

    # Interfaces & Wiring
    # REST API Lollipop between Client and Backend
    draw_lollipop(32.8, 52.2, 0.6, label="REST API")
    ax.plot([30.0, 32.2], [52.2, 52.2], color="#0F172A", lw=1.2)
    ax.annotate("", xy=(33.4, 52.2), xytext=(36.0, 52.2),
                arrowprops=dict(arrowstyle="->", color="#0F172A", lw=1.2))

    # Internal Backend wiring (API Router to domain services)
    for sy in [43.0, 34.5, 26.0, 17.5]:
        ax.annotate("", xy=(50.5, sy + 3.5), xytext=(50.5, sy + 5.0),
                    arrowprops=dict(arrowstyle="->", color="#0D9488", lw=1.0, linestyle=':'))

    # Persistence interfaces
    draw_lollipop(68.0, 51.5, 0.6, label="JDBC / SQL")
    ax.plot([65.5, 67.4], [51.5, 51.5], color="#0F172A", lw=1.2)
    ax.annotate("", xy=(68.6, 51.5), xytext=(71.5, 51.5),
                arrowprops=dict(arrowstyle="->", color="#0F172A", lw=1.2))

    draw_lollipop(68.0, 40.5, 0.6, label="File I/O")
    ax.plot([65.5, 67.4], [40.5, 40.5], color="#0F172A", lw=1.2)
    ax.annotate("", xy=(68.6, 40.5), xytext=(71.5, 40.5),
                arrowprops=dict(arrowstyle="->", color="#0F172A", lw=1.2))

    # External Gateway Interface
    draw_lollipop(68.0, 16.5, 0.6, label="HTTPS / TLS")
    ax.plot([65.5, 67.4], [16.5, 16.5], color="#7C3AED", lw=1.2)
    ax.annotate("", xy=(68.6, 16.5), xytext=(71.5, 16.5),
                arrowprops=dict(arrowstyle="->", color="#7C3AED", lw=1.2))

    # Notes box
    notes = [
        "Loose Coupling: The client-side presentation tier communicates strictly across provided RESTful JSON interfaces via HTTP fetch.",
        "Modular Micro-Services: Backend services ('ProductService', 'OrderService', 'CouponService') encapsulate distinct business logic domains.",
        "Persistence Abstraction: Storage access is segmented into SQLite relational tables ('saisankalp.db') and flat-file audit ledgers ('orders.csv').",
        "Encapsulated Payment Gateway: External communication with Razorpay is mediated through 'Order Processing Service' via secure HTTPS."
    ]
    draw_notes_box(ax, notes, x=2, y=4.2, w=96, h=5.8)
    
    pdf.savefig(fig)
    plt.close()

print("Component diagram defined.")
# =========================================================================
# PAGE 9: DIAGRAM 8 - UML DEPLOYMENT DIAGRAM
# =========================================================================
def render_deployment_diagram(pdf):
    fig, ax = create_base_canvas()
    
    draw_header(ax, "08", "UML DEPLOYMENT DIAGRAM",
                "Hardware Topologies, Physical/Virtual Execution Nodes, Deployed Artifacts & Network Protocols")
    draw_footer(ax, 9, 10)
    
    # Helper to draw a 3D UML Deployment Node
    def draw_3d_node(x, y, w, h, name, stereotype="device", bg="#FFFFFF", border="#334155", dx=1.4, dy=1.2):
        # Top Face
        top_poly = patches.Polygon([[x, y + h], [x + dx, y + h + dy], [x + w + dx, y + h + dy], [x + w, y + h]],
                                   closed=True, facecolor="#F1F5F9", edgecolor=border, linewidth=1.0, zorder=3)
        ax.add_patch(top_poly)
        # Right Face
        right_poly = patches.Polygon([[x + w, y], [x + w + dx, y + dy], [x + w + dx, y + h + dy], [x + w, y + h]],
                                     closed=True, facecolor="#E2E8F0", edgecolor=border, linewidth=1.0, zorder=3)
        ax.add_patch(right_poly)
        # Front Face
        front_rect = patches.Rectangle((x, y), w, h, facecolor=bg, edgecolor=border, linewidth=1.1, zorder=4)
        ax.add_patch(front_rect)
        
        # Header Label
        ax.text(x + w/2, y + h - 1.2, f"«{stereotype}»", fontsize=6.2, fontstyle='italic', color="#475569", ha='center', zorder=5)
        ax.text(x + w/2, y + h - 2.4, name, fontsize=7.8, fontweight='bold', color=COLOR_PRIMARY_DARK, ha='center', zorder=5)

    # Helper to draw an artifact inside a node
    def draw_artifact(x, y, w, h, name, sub="", bg="#EFF6FF", border="#93C5FD"):
        art_box = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.1,rounding_size=0.2",
                                         facecolor=bg, edgecolor=border, linewidth=0.8, zorder=6)
        ax.add_patch(art_box)
        ax.text(x + w/2, y + h/2 + (0.4 if sub else 0), f"«artifact» {name}", fontsize=6.0, fontweight='bold', color=COLOR_PRIMARY_DARK, ha='center', va='center', zorder=7)
        if sub:
            ax.text(x + w/2, y + h/2 - 0.6, sub, fontsize=5.4, color="#64748B", fontfamily='monospace', ha='center', va='center', zorder=7)

    # 1. Client Node (Left Top)
    draw_3d_node(3.0, 36.0, 26.0, 23.0, "Client Workstation / Mobile", stereotype="device", bg="#FFFFFF", border="#2563EB")
    # Execution Environment inside Client
    ee_client = patches.FancyBboxPatch((4.5, 37.5), 23.0, 17.5, boxstyle="round,pad=0.1,rounding_size=0.3",
                                        facecolor="#EFF6FF", edgecolor="#3B82F6", linewidth=0.9, zorder=5)
    ax.add_patch(ee_client)
    ax.text(16.0, 53.6, "«executionEnvironment» Web Browser", fontsize=6.2, fontweight='bold', color="#1D4ED8", ha='center', zorder=6)
    draw_artifact(5.5, 49.0, 21.0, 3.2, "index.html (Single Page App)", bg="#FFFFFF", border="#93C5FD")
    draw_artifact(5.5, 44.8, 21.0, 3.2, "storefront.js & cart.js", "ES6+ Reactive Engine", bg="#FFFFFF", border="#93C5FD")
    draw_artifact(5.5, 40.6, 21.0, 3.2, "admin.js & styles.css", "Admin Dashboard & Assets", bg="#FFFFFF", border="#93C5FD")

    # 2. Reverse Proxy / Gateway Node (Center Top)
    draw_3d_node(37.0, 36.0, 26.0, 23.0, "Edge Web Server & Proxy", stereotype="device", bg="#FFFFFF", border="#0D9488")
    ee_proxy = patches.FancyBboxPatch((38.5, 37.5), 23.0, 17.5, boxstyle="round,pad=0.1,rounding_size=0.3",
                                       facecolor="#ECFEFF", edgecolor="#14B8A6", linewidth=0.9, zorder=5)
    ax.add_patch(ee_proxy)
    ax.text(50.0, 53.6, "«executionEnvironment» Nginx / Gateway", fontsize=6.2, fontweight='bold', color="#0F766E", ha='center', zorder=6)
    draw_artifact(39.5, 49.0, 21.0, 3.2, "nginx.conf", "SSL / TLS 1.3 Termination", bg="#FFFFFF", border="#99F6E4")
    draw_artifact(39.5, 44.8, 21.0, 3.2, "Static Asset Caching Engine", "Gzip / HTTP-2 Distribution", bg="#FFFFFF", border="#99F6E4")
    draw_artifact(39.5, 40.6, 21.0, 3.2, "Reverse Proxy Dispatcher", "Pass to :8000 (Backend)", bg="#FFFFFF", border="#99F6E4")

    # 3. Application Server Node (Right Top)
    draw_3d_node(70.0, 36.0, 26.0, 23.0, "Application Server Host", stereotype="device", bg="#FFFFFF", border="#7C3AED")
    ee_app = patches.FancyBboxPatch((71.5, 37.5), 23.0, 17.5, boxstyle="round,pad=0.1,rounding_size=0.3",
                                     facecolor="#F5F3FF", edgecolor="#8B5CF6", linewidth=0.9, zorder=5)
    ax.add_patch(ee_app)
    ax.text(83.0, 53.6, "«executionEnvironment» Java 17+ / Python 3.11", fontsize=6.2, fontweight='bold', color="#6D28D9", ha='center', zorder=6)
    draw_artifact(72.5, 49.0, 21.0, 3.2, "Server.class (Native Java HTTP)", "com.sun.net.httpserver :8000", bg="#FFFFFF", border="#DDD6FE")
    draw_artifact(72.5, 44.8, 21.0, 3.2, "mock_server.py (WSGI Runtime)", "Lightweight Dev Backend", bg="#FFFFFF", border="#DDD6FE")
    draw_artifact(72.5, 40.6, 21.0, 3.2, "Business Controllers & Routers", "Order, Product, Coupon Logic", bg="#FFFFFF", border="#DDD6FE")

    # Network Protocol Arrows between Top Nodes
    # Client to Proxy: HTTPS / TLS 1.3
    ax.annotate("", xy=(37.0, 47.5), xytext=(29.0, 47.5),
                arrowprops=dict(arrowstyle="<->", color="#0F172A", lw=1.3, mutation_scale=10), zorder=8)
    ax.text(33.0, 49.0, "HTTPS / TLS 1.3", fontsize=6.0, fontweight='bold', color="#0F172A", ha='center', zorder=9)
    ax.text(33.0, 46.0, "Port 443", fontsize=5.4, color="#64748B", ha='center', zorder=9)

    # Proxy to App Server: HTTP / TCP
    ax.annotate("", xy=(70.0, 47.5), xytext=(63.0, 47.5),
                arrowprops=dict(arrowstyle="<->", color="#0F172A", lw=1.3, mutation_scale=10), zorder=8)
    ax.text(66.5, 49.0, "HTTP Loopback", fontsize=6.0, fontweight='bold', color="#0F172A", ha='center', zorder=9)
    ax.text(66.5, 46.0, "Port 8000", fontsize=5.4, color="#64748B", ha='center', zorder=9)

    # 4. Database & Persistence Node (Right Bottom)
    draw_3d_node(70.0, 11.5, 26.0, 20.0, "Storage & Persistence Node", stereotype="device", bg="#FFFFFF", border="#D97706")
    ee_db = patches.FancyBboxPatch((71.5, 12.8), 23.0, 15.0, boxstyle="round,pad=0.1,rounding_size=0.3",
                                    facecolor="#FEF3C7", edgecolor="#F59E0B", linewidth=0.9, zorder=5)
    ax.add_patch(ee_db)
    ax.text(83.0, 26.2, "«executionEnvironment» SQLite 3 / File System", fontsize=6.2, fontweight='bold', color="#B45309", ha='center', zorder=6)
    draw_artifact(72.5, 22.0, 21.0, 2.8, "saisankalp.db (SQLite RDBMS)", "Persistent Relational Tables", bg="#FFFFFF", border="#FDE68A")
    draw_artifact(72.5, 17.8, 21.0, 2.8, "orders.csv & test_orders.csv", "Append-Only Transaction Ledger", bg="#FFFFFF", border="#FDE68A")
    draw_artifact(72.5, 13.6, 21.0, 2.8, "/images/* (Media Volume)", "Artisan Catalog Photography", bg="#FFFFFF", border="#FDE68A")

    # Link from App Server to DB Node
    ax.annotate("", xy=(83.0, 31.5), xytext=(83.0, 36.0),
                arrowprops=dict(arrowstyle="<->", color="#D97706", lw=1.3, mutation_scale=10), zorder=8)
    ax.text(87.5, 33.8, "JDBC / Native I/O", fontsize=6.0, fontweight='bold', color="#D97706", ha='left', zorder=9)

    # 5. External Payment Gateway Cloud Node (Left Bottom)
    draw_3d_node(18.0, 11.5, 36.0, 20.0, "Razorpay Cloud Infrastructure", stereotype="cloud-device", bg="#FFFFFF", border="#7C3AED")
    ee_cloud = patches.FancyBboxPatch((19.5, 12.8), 33.0, 15.0, boxstyle="round,pad=0.1,rounding_size=0.3",
                                      facecolor="#F5F3FF", edgecolor="#8B5CF6", linewidth=0.9, zorder=5)
    ax.add_patch(ee_cloud)
    ax.text(36.0, 26.2, "«executionEnvironment» Razorpay Core Banking API", fontsize=6.2, fontweight='bold', color="#6D28D9", ha='center', zorder=6)
    draw_artifact(21.0, 22.0, 30.0, 2.8, "Razorpay Payment Gateway API", "Card / NetBanking Processing", bg="#FFFFFF", border="#DDD6FE")
    draw_artifact(21.0, 17.8, 30.0, 2.8, "UPI VPA Switch & Dynamic QR Engine", "Instant Settlement Network", bg="#FFFFFF", border="#DDD6FE")
    draw_artifact(21.0, 13.6, 30.0, 2.8, "HMAC Webhook Callback Dispatcher", "Cryptographic Signature Dispatch", bg="#FFFFFF", border="#DDD6FE")

    # Link from App Server to Razorpay Cloud
    ax.annotate("", xy=(54.0, 21.5), xytext=(70.0, 38.0),
                arrowprops=dict(arrowstyle="<->", color="#7C3AED", lw=1.3, linestyle='--', mutation_scale=10), zorder=8)
    ax.text(60.0, 29.5, "HTTPS REST / TLS 1.3", fontsize=6.0, fontweight='bold', color="#7C3AED", rotation=36, ha='center', zorder=9)

    # Link from Client Browser to Razorpay Modal
    ax.annotate("", xy=(26.0, 31.5), xytext=(16.0, 36.0),
                arrowprops=dict(arrowstyle="<->", color="#2563EB", lw=1.2, linestyle=':', mutation_scale=10), zorder=8)
    ax.text(17.5, 33.2, "Checkout Modal / JS SDK", fontsize=5.8, color="#2563EB", rotation=-24, zorder=9)

    # Notes box
    notes = [
        "Network Segmentation: Client browsers interact securely through an Edge Reverse Proxy running TLS 1.3 on standard port 443.",
        "Runtime Dualism: Supports production deployment via embedded Java HTTP Server ('Server.java') or lightweight Python ('mock_server.py').",
        "Storage Topology: SQLite RDBMS ('saisankalp.db') resides on persistent local volume storage, flanked by flat CSV audit logging.",
        "External Cloud Bridge: Secure outbound REST communication over HTTPS to Razorpay ensures PCI-DSS isolation for customer card data."
    ]
    draw_notes_box(ax, notes, x=2, y=4.2, w=96, h=5.8)
    
    pdf.savefig(fig)
    plt.close()

print("Deployment diagram defined.")
# =========================================================================
# PAGE 10: ARCHITECTURAL TRACEABILITY MATRIX & SYNTHESIS
# =========================================================================
def render_traceability_matrix(pdf):
    fig, ax = create_base_canvas()
    
    draw_header(ax, "09", "ARCHITECTURAL TRACEABILITY MATRIX",
                "Full System Synthesis: Cross-Reference Mapping UML Model Elements to Concrete Codebase Files, Database Tables & REST APIs")
    draw_footer(ax, 10, 10)
    
    # Table Container Box
    table_box = patches.FancyBboxPatch((2.0, 24.0), 96.0, 37.0, boxstyle="round,pad=0.2,rounding_size=0.4",
                                       facecolor="#FFFFFF", edgecolor="#94A3B8", linewidth=1.0, zorder=3)
    ax.add_patch(table_box)
    
    # Table Header Row
    th = patches.Rectangle((2.0, 57.0), 96.0, 4.0, facecolor="#1E293B", edgecolor='none', zorder=4)
    ax.add_patch(th)
    
    cols = [
        ("UML DIAGRAM", 3.0, 16.0),
        ("VIEWPOINT", 19.5, 11.0),
        ("KEY MODELED CONCEPTS", 31.0, 25.0),
        ("REPOSITORY CODEBASE ARTIFACTS", 56.5, 23.0),
        ("DATA STORES & REST ENDPOINTS", 80.0, 17.5)
    ]
    
    for c_title, cx, cw in cols:
        ax.text(cx + 0.8, 59.0, c_title, fontsize=6.8, fontweight='bold', color="#93C5FD", va='center', zorder=5)

    # Table Rows
    rows_data = [
        ("01. Class Diagram", "Structural", "User, Product, Category, Order, OrderItem, Coupon, Payment", "Server.java, mock_server.py, models.py", "saisankalp.db (7 Tables), JSON schema"),
        ("02. Use Case Diagram", "Functional", "Storefront, Checkout, Coupon Engine, Admin Ops, Razorpay", "index.html, storefront.js, admin.js", "/api/products, /api/orders, /api/auth"),
        ("03. Sequence Diagram", "Behavioral", "Cart checkout, Razorpay order, HMAC verification, Atomic commit", "cart.js, payment_gateway.html, Server.java", "POST /api/payment/create-order, /api/orders"),
        ("04. Collaboration Diagram", "Behavioral / Structural", "Inter-object messaging graph, Facade controller, Dual ledger", "cart.js, mock_server.py, orders.csv", "saisankalp.db, orders.csv audit stream"),
        ("05. Activity Diagram", "Process / Workflow", "Swimlanes, Decision diamonds, Stock decrement, Warehousing", "storefront.js, cart.js, Server.java", "GET /api/products, POST /api/orders"),
        ("06. State Chart Diagram", "Dynamic Lifecycle", "Order state machine (Draft -> Pending -> Processing -> Delivered)", "cart.js, admin.js, Server.java", "PUT /api/orders/:id/status"),
        ("07. Component Diagram", "Modular Architecture", "Presentation SPA, Service Tier, SQLite Engine, Razorpay", "js/ (storefront, cart, admin), Server.java", "RESTful JSON APIs, File Storage Adapter"),
        ("08. Deployment Diagram", "Physical Topology", "Client Browser, Nginx Proxy, Java/Python Host, SQLite Node", "Server.java, mock_server.py, run.ps1", "TLS 1.3 (Port 443), Localhost (Port 8000)")
    ]

    for idx, (diag_name, view_type, concepts, artifacts, stores) in enumerate(rows_data):
        ry = 53.0 - (idx * 3.6)
        row_bg = "#F8FAFC" if idx % 2 == 0 else "#FFFFFF"
        r_rect = patches.Rectangle((2.1, ry), 95.8, 3.6, facecolor=row_bg, edgecolor='none', zorder=4)
        ax.add_patch(r_rect)
        
        # Divider line
        ax.plot([2.0, 98.0], [ry, ry], color="#E2E8F0", linewidth=0.6, zorder=5)
        
        ax.text(3.8, ry + 1.8, diag_name, fontsize=6.3, fontweight='bold', color=COLOR_PRIMARY_DARK, va='center', zorder=6)
        
        # Viewpoint badge
        badge_bg = "#EFF6FF" if view_type.startswith("Struct") else ("#F0FDF4" if view_type.startswith("Behav") else "#FEF3C7")
        badge_col = "#1D4ED8" if view_type.startswith("Struct") else ("#166534" if view_type.startswith("Behav") else "#92400E")
        v_pill = patches.FancyBboxPatch((19.8, ry + 0.6), 9.5, 2.3, boxstyle="round,pad=0.1,rounding_size=0.2",
                                        facecolor=badge_bg, edgecolor=badge_col, linewidth=0.6, zorder=5)
        ax.add_patch(v_pill)
        ax.text(24.55, ry + 1.75, view_type, fontsize=5.6, fontweight='bold', color=badge_col, ha='center', va='center', zorder=6)
        
        ax.text(31.8, ry + 1.8, concepts, fontsize=5.8, color="#334155", va='center', zorder=6)
        ax.text(57.3, ry + 1.8, artifacts, fontsize=5.8, color="#0284C7", fontfamily='monospace', va='center', zorder=6)
        ax.text(80.8, ry + 1.8, stores, fontsize=5.8, color="#D97706", fontfamily='monospace', va='center', zorder=6)

    # Quality Attributes Summary Card
    qa_box = patches.FancyBboxPatch((2.0, 11.0), 96.0, 11.5, boxstyle="round,pad=0.2,rounding_size=0.4",
                                    facecolor="#F1F5F9", edgecolor="#CBD5E1", linewidth=0.9, zorder=3)
    ax.add_patch(qa_box)
    
    ax.text(3.5, 20.8, "SYSTEM QUALITY ATTRIBUTES & ARCHITECTURAL VERIFICATION:",
            fontsize=7.2, fontweight='bold', color=COLOR_PRIMARY_DARK, zorder=4)
            
    qa_items = [
        ("Data Consistency & ACID Compliance:", "SQLite transaction locks guarantee zero phantom decrements or inventory corruption during simultaneous checkouts."),
        ("Security & Cryptographic Integrity:", "HMAC SHA-256 signatures validate Razorpay payment receipts prior to order finalization, guarding against MITM tampered amounts."),
        ("High Availability & Fault Tolerance:", "Dual persistence architecture logs transactions to SQLite RDBMS alongside flat 'orders.csv' audit ledgers for zero data loss."),
        ("Decoupled Extensibility:", "Independent client-side SPA modules ('storefront.js', 'cart.js', 'admin.js') consume standard REST endpoints, allowing easy UI refreshes.")
    ]
    
    for q_idx, (q_title, q_desc) in enumerate(qa_items):
        row_y = 18.5 - (q_idx * 2.2)
        ax.text(4.0, row_y, f"✔  {q_title}", fontsize=6.2, fontweight='bold', color="#166534", zorder=5)
        ax.text(28.0, row_y, q_desc, fontsize=6.2, color="#334155", zorder=5)

    # Notes box
    notes = [
        "Complete UML 2.5 Conformance: Delivers all 8 requested UML diagrams spanning structural, behavioral, process, and physical deployment views.",
        "Engineering Alignment: All 8 diagrams directly align with the active Sai Sankalp codebase, SQL schemas ('saisankalp.db'), and JavaScript engines.",
        "Production Readiness: Incorporates real-world enterprise requirements including payment gateways, inventory rollback, and CSV ledgers.",
        "Document Provenance: Compiled and verified for software architecture documentation, design reviews, and academic presentation standards."
    ]
    draw_notes_box(ax, notes, x=2, y=4.2, w=96, h=5.8)
    
    pdf.savefig(fig)
    plt.close()

print("Traceability matrix defined.")

# =========================================================================
# MAIN DRIVER FUNCTION
# =========================================================================
def generate_all_diagrams_pdf(output_path):
    print(f"Generating full 10-page UML PDF at: {output_path}")
    png_dir = r"c:\Users\sameer marla\OneDrive\Documents\sai sankalp files updated\uml_diagrams_preview"
    os.makedirs(png_dir, exist_ok=True)
    page_counter = [0]
    names = [
        "00_cover_page",
        "01_class_diagram",
        "02_use_case_diagram",
        "03_sequence_diagram",
        "04_collaboration_diagram",
        "05_activity_diagram",
        "06_state_chart_diagram",
        "07_component_diagram",
        "08_deployment_diagram",
        "09_traceability_matrix"
    ]
    with PdfPages(output_path) as pdf:
        orig_savefig = pdf.savefig
        def custom_savefig(fig, *args, **kwargs):
            orig_savefig(fig, *args, **kwargs)
            page_counter[0] += 1
            idx = page_counter[0] - 1
            name = names[idx] if idx < len(names) else f"page_{page_counter[0]}"
            png_file = os.path.join(png_dir, f"{name}.png")
            fig.savefig(png_file, dpi=200, bbox_inches="tight")
            print(f"  [Exported Preview Image: {name}.png]")
        pdf.savefig = custom_savefig

        print("Rendering Page 1: Cover Page...")
        render_cover_page(pdf)
        
        print("Rendering Page 2: 01. Class Diagram...")
        render_class_diagram(pdf)
        
        print("Rendering Page 3: 02. Use Case Diagram...")
        render_use_case_diagram(pdf)
        
        print("Rendering Page 4: 03. Sequence Diagram...")
        render_sequence_diagram(pdf)
        
        print("Rendering Page 5: 04. Collaboration Diagram...")
        render_collaboration_diagram(pdf)
        
        print("Rendering Page 6: 05. Activity Diagram...")
        render_activity_diagram(pdf)
        
        print("Rendering Page 7: 06. State Chart Diagram...")
        render_state_chart_diagram(pdf)
        
        print("Rendering Page 8: 07. Component Diagram...")
        render_component_diagram(pdf)
        
        print("Rendering Page 9: 08. Deployment Diagram...")
        render_deployment_diagram(pdf)
        
        print("Rendering Page 10: 09. Architectural Traceability Matrix...")
        render_traceability_matrix(pdf)

    print(f"Successfully generated 10-page UML specification PDF at: {output_path}")

if __name__ == "__main__":
    out_pdf = r"c:\Users\sameer marla\OneDrive\Documents\sai sankalp files updated\Sai_Sankalp_All_8_UML_Diagrams.pdf"
    if len(sys.argv) > 1:
        out_pdf = sys.argv[1]
    generate_all_diagrams_pdf(out_pdf)
