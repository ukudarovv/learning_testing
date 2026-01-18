import { MapPin } from 'lucide-react';

interface GoogleMapProps {
  address?: string;
  latitude?: number;
  longitude?: number;
  height?: string;
  className?: string;
}

export function GoogleMap({ 
  address = 'г. Атырау, ул. Студенческий 25, БЦ Bayterek Plaza',
  latitude = 47.10189431406451,
  longitude = 51.91418497800475,
  height = '400px',
  className = ''
}: GoogleMapProps) {
  // Используем прямой embed URL из Google Maps
  const mapEmbedUrl = 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d960.2000836350389!2d51.91418497800475!3d47.10189431406451!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x41a3ea26ef81d553%3A0x25f7332a93e6065e!2z0KHRgtGD0LTQtdC90YfQtdGB0LrQuNC5INC_0YDQvtGB0L8uIDI1LCDQkNGC0YvRgNCw0YM!5e0!3m2!1sru!2skz!4v1768742652841!5m2!1sru!2skz';

  return (
    <div className={`rounded-xl overflow-hidden border border-gray-300 shadow-md ${className}`} style={{ height }}>
      <div className="relative w-full h-full">
        <iframe
          src={mapEmbedUrl}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="Карта расположения офиса UniCover"
        />
        <div className="absolute bottom-2 right-2 bg-white px-3 py-1 rounded-lg shadow-sm text-xs text-gray-600">
          <a
            href={`https://www.google.com/maps?q=${latitude},${longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-blue-600"
          >
            <MapPin className="w-3 h-3" />
            Открыть в Google Maps
          </a>
        </div>
      </div>
    </div>
  );
}

