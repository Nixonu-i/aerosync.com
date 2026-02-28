import base64
import io
from django.utils import timezone
import qrcode
from PIL import Image, ImageDraw, ImageFont

from .models import Booking, BoardingPass


def make_qr_png_base64(data: str) -> str:
    qr = qrcode.make(data).convert("RGB")
    buf = io.BytesIO()
    qr.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def _adjust_font_size_for_text(draw, text, initial_font, max_width):
    """
    Adjust font size to fit text within max_width.
    """
    if draw.textlength(text, font=initial_font) <= max_width:
        return initial_font
    
    # Get the original font properties
    try:
        # Extract font file path and size from the original font
        original_size = initial_font.size
    except AttributeError:
        # If it's a default font, return original since we can't resize it
        return initial_font
    
    # Try to determine the font file based on the original font
    font_file = None
    try:
        font_file = initial_font.path
    except AttributeError:
        # Determine font file based on font characteristics
        if hasattr(initial_font, 'getname'):
            font_name = initial_font.getname()[0]
            if 'Bold' in font_name:
                font_file = "DejaVuSans-Bold.ttf"
            else:
                font_file = "DejaVuSans.ttf"
        else:
            font_file = "DejaVuSans-Bold.ttf"  # Default fallback
    
    # Try with decreasing font sizes
    for size in range(original_size, 10, -2):  # Try from original size down to 10, decrementing by 2
        try:
            test_font = ImageFont.truetype(font_file, size)
            if draw.textlength(text, font=test_font) <= max_width:
                return test_font
        except Exception:
            # If font loading fails, try with the default font
            break
    
    # If we can't load the specific font, try to use a smaller size with default font
    # This is a fallback approach
    return initial_font


def _fit_text(draw, text, font, max_width):
    """
    If text is too long for max_width, truncate with ellipsis.
    (Kept for other uses, but not used for passenger name)
    """
    if draw.textlength(text, font=font) <= max_width:
        return text
    
    # Start with the ellipsis
    ellipsis = "..."
    if draw.textlength(ellipsis, font=font) >= max_width:
        # If even the ellipsis is too wide, truncate the text to fit
        while text and draw.textlength(text, font=font) > max_width:
            text = text[:-1]
        return text
    
    # Try to find the longest substring that fits with ellipsis
    left, right = 0, len(text)
    result = ""
    
    while left <= right:
        mid = (left + right) // 2
        candidate = text[:mid] + ellipsis
        candidate_width = draw.textlength(candidate, font=font)
        
        if candidate_width <= max_width:
            result = candidate
            left = mid + 1
        else:
            right = mid - 1
    
    return result if result else text[:1] if text else ""


def build_boarding_pass_png(booking: Booking, passenger=None) -> bytes:
    """Generate boarding pass for a specific passenger in a booking
    If passenger is None, generates for the first passenger
    """
    if not passenger:
        passenger = booking.passengers.first()
    
    # Find boarding pass for this specific passenger
    bp = booking.boarding_passes.filter(passenger=passenger).first()
    
    if not bp:
        raise ValueError("Boarding pass not found for passenger")
    
    flight = booking.flight

    pax_name = passenger.full_name if passenger else "UNKNOWN"
    dep = flight.departure_airport.code
    arr = flight.arrival_airport.code
    dep_name = flight.departure_airport.name
    arr_name = flight.arrival_airport.name
    dep_city = flight.departure_airport.city
    arr_city = flight.arrival_airport.city

    tz = timezone.get_current_timezone()
    dep_time = flight.departure_time.astimezone(tz).strftime("%d %b %Y %H:%M")
    arr_time = flight.arrival_time.astimezone(tz).strftime("%d %b %Y %H:%M")

    ref = booking.confirmation_code
    seat_no = bp.seat.seat_number            # SEAT shown ONCE
    seat_class = bp.seat.flight_class
    aircraft = flight.aircraft.number_plate
    flight_no = f"AS-{flight.id:04d}"

    qr_payload = bp.qr_code_data

    # Canvas
    W, H = 1400, 620     # wider to fit a real QR panel and better column separation
    bg = "#0b1220"
    gold = "#d4af37"
    white = "#ffffff"
    gray = "#cbd5e1"

    img = Image.new("RGB", (W, H), bg)
    draw = ImageDraw.Draw(img)

    # Fonts
    try:
        title_font = ImageFont.truetype("DejaVuSans-Bold.ttf", 54)
        route_font = ImageFont.truetype("DejaVuSans-Bold.ttf", 72)
        label_font = ImageFont.truetype("DejaVuSans.ttf", 24)
        value_font = ImageFont.truetype("DejaVuSans-Bold.ttf", 34)
        small_font = ImageFont.truetype("DejaVuSans.ttf", 20)
        small_bold = ImageFont.truetype("DejaVuSans-Bold.ttf", 22)
    except Exception:
        title_font = route_font = value_font = ImageFont.load_default()
        label_font = small_font = small_bold = ImageFont.load_default()

    # Header strip
    draw.rectangle([0, 0, W, 95], fill=gold)
    draw.text((40, 22), "AEROSYNC", fill=bg, font=title_font)
    draw.text((W - 300, 30), "BOARDING PASS", fill=bg, font=small_font)

    # Route (centered)
    route_text = f"{dep}  →  {arr}"
    rt_w = draw.textlength(route_text, font=route_font)
    draw.text(((W - rt_w) / 2, 125), route_text, fill=white, font=route_font)
    
    # Airport Names (under the route)
    airport_text = f"{dep_city}, {dep_name}  →  {arr_city}, {arr_name}"
    try:
        airport_font = ImageFont.truetype("DejaVuSans.ttf", 28)
    except Exception:
        airport_font = ImageFont.load_default()
    airport_w = draw.textlength(airport_text, font=airport_font)
    draw.text(((W - airport_w) / 2, 200), airport_text, fill=gold, font=airport_font)

    # Layout columns:
    # Left column: passenger/ref/times
    # Middle column: seat/class/aircraft/flight
    # Right panel: QR (no overlap)
    xL = 70
    xM = 700    # Moved middle column further right to avoid overlap
    qr_panel_x = 1020     # everything left of this must stay clear
    safe_right_edge = qr_panel_x - 40

    y0 = 250
    gap = 92

    def label_value(x, y, label, value, max_width, use_dynamic_font=False):
        draw.text((x, y), label, fill=gray, font=label_font)
        if use_dynamic_font and label == "Passenger":
            # Use dynamic font sizing for passenger name
            adjusted_font = _adjust_font_size_for_text(draw, value, value_font, max_width)
            # Draw passenger name with some extra space to avoid overlap
            draw.text((x, y + 30), value, fill=white, font=adjusted_font)
        else:
            # Use original fitting for other fields
            value = _fit_text(draw, value, value_font, max_width)
            draw.text((x, y + 30), value, fill=white, font=value_font)

    # Left block
    label_value(xL, y0 + gap * 0, "Passenger", pax_name, max_width=safe_right_edge - xL, use_dynamic_font=True)
    label_value(xL, y0 + gap * 1, "Booking Ref", ref, max_width=safe_right_edge - xL)
    label_value(xL, y0 + gap * 2, "Departure", dep_time, max_width=safe_right_edge - xL)
    label_value(xL, y0 + gap * 3, "Arrival", arr_time, max_width=safe_right_edge - xL)

    # Middle block (kept away from QR)
    label_value(xM, y0 + gap * 0, "Seat", seat_no, max_width=safe_right_edge - xM)
    label_value(xM, y0 + gap * 1, "Class", seat_class, max_width=safe_right_edge - xM)
    label_value(xM, y0 + gap * 2, "Aircraft", aircraft, max_width=safe_right_edge - xM)
    label_value(xM, y0 + gap * 3, "Flight", flight_no, max_width=safe_right_edge - xM)

    # QR panel background (subtle card)
    panel_top = 280  # Increased from 210 to accommodate new airport names
    panel_bottom = H - 40
    draw.rounded_rectangle([qr_panel_x, panel_top, W - 40, panel_bottom], radius=18, fill="#111b2e")

    # QR code inside panel
    qr = qrcode.make(qr_payload).convert("RGB")
    qr_size = 250
    qr = qr.resize((qr_size, qr_size))
    qr_x = qr_panel_x + ((W - 40 - qr_panel_x) - qr_size) // 2
    qr_y = panel_top + 40  # Adjusted position to center QR code in new panel
    img.paste(qr, (qr_x, qr_y))

    # QR label
    label = "Scan to verify"
    lw = draw.textlength(label, font=small_bold)
    label_x = qr_panel_x + ((W - 40 - qr_panel_x) - lw) // 2
    draw.text((label_x, panel_bottom - 35), label, fill=gray, font=small_bold)  # Position at bottom of panel

    out = io.BytesIO()
    img.save(out, format="PNG")
    return out.getvalue()

def ensure_boarding_pass(booking: Booking, seat) -> BoardingPass:
    """
    Create boarding pass if doesn't exist.
    """
    try:
        return booking.boarding_pass
    except BoardingPass.DoesNotExist:
        passenger = booking.passengers.first()
        pax_name = passenger.full_name if passenger else "UNKNOWN"
        qr_data = f"AEROSYNC|REF={booking.confirmation_code}|FLIGHT={booking.flight_id}|SEAT={seat.seat_number}|PAX={pax_name}"

        bp = BoardingPass.objects.create(
            booking=booking,
            seat=seat,
            qr_code_data=qr_data,
        )
        return bp