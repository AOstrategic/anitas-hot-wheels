import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, ChevronLeft, ChevronRight, X, Sparkles, Check, Edit2, Trash2, Loader2, RefreshCw } from 'lucide-react';
import logoImg from './assets/logo.png';

const SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || '';
const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

const ALLOWED_CATEGORIES = [
  'Hypercar', 'Supercar', 'Formula 1', 'GT Race Car', 'Classic GT',
  'Classic Race Car', 'Classic Roadster', 'Classic Convertible', 'Classic Compact',
  'Classic Rally/Touring Car', 'Concept Race Car', 'Convertible Sports Car',
  'Muscle Car', 'Grand Tourer', 'Sports Car', 'Sports Coupe',
  'Sports Sedan', 'Roadster / Sports Car', 'Movie / TV Car',
  'Fantasy / Character Car', 'TV / Cartoon Vehicle'
];

const ALLOWED_TYPES = [
  'Hot Wheels',
  'LEGO',
  'Large Scale',
  'Other 1:64'
];

const normalizeVehicleType = (car) => {
  if (!car) return 'Hot Wheels';
  if (car.type && ALLOWED_TYPES.includes(car.type)) {
    return car.type;
  }
  if (car.type) {
    const matched = ALLOWED_TYPES.find((t) => t.toLowerCase() === car.type.toLowerCase());
    if (matched) return matched;
  }
  const hw = car.hotWheels || car.hot_wheels;
  if (hw === 'Yes' || hw === true) {
    return 'Hot Wheels';
  }
  if (hw === 'No' || hw === false) {
    return 'Other 1:64';
  }
  return 'Hot Wheels';
};

const getFallbackImage = (text = 'Hot Wheels') => {
  const safeText = (text || 'Car').replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 24);
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="600" height="400" fill="%231C1C1C"/><circle cx="300" cy="200" r="140" fill="%23121212"/><text x="50%" y="46%" dominant-baseline="middle" text-anchor="middle" fill="%23FF8000" font-family="system-ui,sans-serif" font-weight="900" font-size="28" letter-spacing="2">NO PHOTO</text><text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle" fill="%23A1A1AA" font-family="system-ui,sans-serif" font-weight="600" font-size="16">${encodeURIComponent(safeText)}</text></svg>`;
};

const hasValidStudioImage = (car) => {
  if (!car || !car.imageUrl) return false;
  const url = car.imageUrl.trim();
  if (!url) return false;
  if (url.startsWith('data:image/svg+xml')) return false;
  if (url.toLowerCase().includes('placeholder') || url.toLowerCase().includes('no-photo') || url.toLowerCase().includes('no_photo')) return false;
  return true;
};

const getDailyDateHash = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  return y * 10000 + m * 100 + d;
};

export default function App() {
  const [collection, setCollection] = useState([]);
  const [stats, setStats] = useState({ total: 0, brands: 0, hotWheels: 0, nonHotWheels: 0 });
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);
  const [isFading, setIsFading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingCarId, setEditingCarId] = useState(null);

  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRenderingNanoBanana, setIsRenderingNanoBanana] = useState(false);

  const [mainPhoto, setMainPhoto] = useState(null);
  const [stampPhoto, setStampPhoto] = useState(null);
  const [normalisedPreview, setNormalisedPreview] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [extractedData, setExtractedData] = useState({
    brand: '',
    model: '',
    colour: '',
    country: '',
    category: 'Sports Car',
    type: 'Hot Wheels',
    imageUrl: ''
  });

  const canvasRef = useRef(null);

  useEffect(() => {
    fetchCollection();
  }, []);

  const fetchCollection = async () => {
    if (!SCRIPT_URL) return;
    try {
      const res = await fetch(SCRIPT_URL);
      const data = await res.json();
      if (data.cars) {
        const normalizedCars = data.cars.map((car) => ({
          ...car,
          type: normalizeVehicleType(car)
        }));
        setCollection(normalizedCars);
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch (err) {
      console.error('Failed to load collection:', err);
    }
  };

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = (error) => reject(error);
    });

  const renderFallbackCroppedImage = (input) => {
    const handleImageElement = (img) => {
      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 400;
      const ctx = canvas.getContext('2d');

      // Studio radial gradient background
      const grad = ctx.createRadialGradient(300, 200, 50, 300, 200, 320);
      grad.addColorStop(0, '#262626');
      grad.addColorStop(1, '#121212');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Contact shadow
      ctx.save();
      const shadowGrad = ctx.createRadialGradient(300, 280, 20, 300, 280, 190);
      shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
      shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = shadowGrad;
      ctx.beginPath();
      ctx.ellipse(300, 280, 190, 32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const scale = Math.min(canvas.width / img.width, canvas.height / img.height) * 0.85;
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      ctx.drawImage(img, (canvas.width - drawW) / 2, (canvas.height - drawH) / 2, drawW, drawH);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      setNormalisedPreview(dataUrl);
    };

    if (input instanceof File || input instanceof Blob) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => handleImageElement(img);
        img.src = e.target.result;
      };
      reader.readAsDataURL(input);
    } else if (typeof input === 'string') {
      const img = new Image();
      img.onload = () => handleImageElement(img);
      img.src = input.startsWith('data:') ? input : `data:image/jpeg;base64,${input}`;
    }
  };

  const processAndNormaliseImage = async (input) => {
    if (!input) return;

    if (!GEMINI_KEY) {
      alert('Gemini API key is required (VITE_GEMINI_API_KEY). Falling back to original image.');
      renderFallbackCroppedImage(input);
      return;
    }

    setIsRenderingNanoBanana(true);
    try {
      let base64Image = '';
      if (input instanceof File || input instanceof Blob) {
        base64Image = await toBase64(input);
      } else if (typeof input === 'string') {
        base64Image = input.includes('base64,') ? input.split('base64,')[1] : input;
      }

      const prompt = "High-end automotive catalogue product photography of this exact die-cast car. Completely remove the table, paper, and room background. Center the car on a sleek, dark charcoal turntable pedestal with subtle tyre contact shadows and soft ambient lighting against a seamless dark carbon background. Maintain all original casting details, paint finish, tampos, and wheel proportions exactly.";

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent?key=${GEMINI_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: "image/jpeg",
                    data: base64Image
                  }
                }
              ]
            }
          ],
          generationConfig: {
            responseModalities: ["IMAGE"]
          }
        })
      });

      const json = await res.json();
      if (json.error) {
        throw new Error(json.error.message || 'Gemini API Error');
      }

      const candidate = json.candidates?.[0];
      const imagePart = candidate?.content?.parts?.find((p) => p.inlineData || p.inline_data);
      if (imagePart) {
        const dataObj = imagePart.inlineData || imagePart.inline_data;
        const mime = dataObj.mimeType || dataObj.mime_type || 'image/png';
        const b64 = dataObj.data;
        setNormalisedPreview(`data:${mime};base64,${b64}`);
      } else {
        const textMsg = candidate?.content?.parts?.[0]?.text;
        throw new Error(textMsg || 'No studio image was returned by Nano Banana 2.');
      }
    } catch (err) {
      alert('Nano Banana 2 studio staging failed: ' + err.message + '\nFalling back to cropped original image.');
      renderFallbackCroppedImage(input);
    } finally {
      setIsRenderingNanoBanana(false);
    }
  };

  const handleMainPhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setMainPhoto(file);
      setRemoveImage(false);
      processAndNormaliseImage(file);
    }
  };

  const handleRegenerateStudioStaging = () => {
    if (mainPhoto) {
      processAndNormaliseImage(mainPhoto);
    } else if (normalisedPreview) {
      processAndNormaliseImage(normalisedPreview);
    } else {
      alert('Please select or upload a car photo first.');
    }
  };

  const handleStampPhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setStampPhoto(file);
    }
  };

  const handleRemovePhoto = () => {
    setRemoveImage(true);
    setNormalisedPreview(null);
    setMainPhoto(null);
    setExtractedData((prev) => (prev ? { ...prev, imageUrl: '' } : null));
  };

  const scanWithGemini = async () => {
    if (!mainPhoto || !GEMINI_KEY) {
      alert('Vehicle photo and Gemini API key are required.');
      return;
    }

    setIsScanning(true);
    try {
      const mainBase64 = await toBase64(mainPhoto);
      const parts = [
        { text: "Examine the die-cast or brick vehicle photo(s). Extract the technical details strictly matching the schema." },
        { inline_data: { mime_type: "image/jpeg", data: mainBase64 } }
      ];

      if (stampPhoto) {
        const stampBase64 = await toBase64(stampPhoto);
        parts.push({ inline_data: { mime_type: "image/jpeg", data: stampBase64 } });
      }

      const promptSystem = "You are an expert Hot Wheels, LEGO Speed Champions, and die-cast vehicle archivist. Extract details for the car database:\n" +
        "- Brand: Vehicle manufacturer or automotive brand.\n" +
        "- Model: Full model name.\n" +
        "- Colour: Dominant body paint or brick colour.\n" +
        "- Country: Origin country of the car brand.\n" +
        "- Category: Choose strictly one of: " + ALLOWED_CATEGORIES.join(', ') + ".\n" +
        "- Type: Choose strictly one of: 'Hot Wheels' (standard 1:64 Hot Wheels casting), 'LEGO' (Speed Champions or brick-built vehicle), 'Large Scale' (1:24, 1:18, or large pull-backs), 'Other 1:64' (Matchbox, Majorette, Tomica, etc.).\n" +
        "- Confidence: Short summary of visual clues, scale, and markings.";

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${GEMINI_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: promptSystem }] },
          contents: [{ parts: parts }],
          generationConfig: {
            response_mime_type: "application/json",
            response_schema: {
              type: "OBJECT",
              properties: {
                brand: { type: "STRING" },
                model: { type: "STRING" },
                colour: { type: "STRING" },
                country: { type: "STRING" },
                category: { type: "STRING", enum: ALLOWED_CATEGORIES },
                type: { type: "STRING", enum: ALLOWED_TYPES },
                confidence_notes: { type: "STRING" }
              },
              required: ["brand", "model", "colour", "country", "category", "type"]
            }
          }
        })
      });

      const json = await res.json();
      const parsed = JSON.parse(json.candidates[0].content.parts[0].text);
      setExtractedData({
        ...parsed,
        type: parsed.type || 'Hot Wheels'
      });
    } catch (err) {
      alert('Scanning failed: ' + err.message);
    } finally {
      setIsScanning(false);
    }
  };

  const openAddModal = () => {
    setIsEditMode(false);
    setEditingCarId(null);
    setMainPhoto(null);
    setStampPhoto(null);
    setRemoveImage(false);
    setNormalisedPreview(null);
    setExtractedData({
      brand: '',
      model: '',
      colour: '',
      country: '',
      category: 'Sports Car',
      type: 'Hot Wheels',
      imageUrl: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (car) => {
    setIsEditMode(true);
    setEditingCarId(car.id);
    setMainPhoto(null);
    setStampPhoto(null);
    setRemoveImage(false);
    setNormalisedPreview(car.imageUrl || null);
    setExtractedData({
      brand: car.brand,
      model: car.model,
      colour: car.colour,
      country: car.country,
      category: car.category,
      type: normalizeVehicleType(car),
      imageUrl: car.imageUrl || ''
    });
    setIsModalOpen(true);
  };

  const handleSaveCar = async () => {
    if (!extractedData.brand || !extractedData.model) {
      alert('Brand and Model are required.');
      return;
    }

    if (!isEditMode) {
      const isDuplicate = collection.some(
        (c) => c.brand.toLowerCase() === extractedData.brand.toLowerCase() &&
          c.model.toLowerCase() === extractedData.model.toLowerCase()
      );

      if (isDuplicate) {
        const confirmSave = window.confirm(
          `This ${extractedData.brand} ${extractedData.model} is already in Anita's collection. Save duplicate casting anyway?`
        );
        if (!confirmSave) return;
      }
    }

    setIsSaving(true);
    try {
      const vehicleType = extractedData.type || 'Hot Wheels';
      const payload = {
        action: isEditMode ? 'update' : 'create',
        id: editingCarId,
        brand: extractedData.brand,
        model: extractedData.model,
        colour: extractedData.colour,
        country: extractedData.country,
        category: extractedData.category,
        type: vehicleType,
        hotWheels: vehicleType === 'Hot Wheels' ? 'Yes' : 'No',
        imageUrl: removeImage ? '' : (extractedData.imageUrl || ''),
        imageBase64: removeImage ? '' : ((normalisedPreview && normalisedPreview.startsWith('data:image')) ? normalisedPreview : ''),
        removeImage: Boolean(removeImage)
      };

      await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });

      setIsModalOpen(false);
      setExtractedData(null);
      setMainPhoto(null);
      setStampPhoto(null);
      setNormalisedPreview(null);
      setRemoveImage(false);
      fetchCollection();
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const typeCounts = useMemo(() => {
    let hw = 0;
    let lego = 0;
    let other = 0;
    collection.forEach((c) => {
      const t = normalizeVehicleType(c);
      if (t === 'Hot Wheels') hw++;
      else if (t === 'LEGO') lego++;
      else other++;
    });
    return {
      total: collection.length,
      hotWheels: hw,
      lego: lego,
      other: other
    };
  }, [collection]);

  const filteredCars = collection.filter((c) => {
    const matchesSearch = !search ||
      c.model.toLowerCase().includes(search.toLowerCase()) ||
      c.brand.toLowerCase().includes(search.toLowerCase()) ||
      c.colour.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !selectedCategory || c.category === selectedCategory;
    const carType = normalizeVehicleType(c);
    const matchesType = !selectedType || carType === selectedType;
    return matchesSearch && matchesCategory && matchesType;
  });

  const hasInitializedAnchor = useRef(false);

  // Filter curated studio-staged vehicles (falling back gracefully to full collection if none exist yet)
  const stagedCars = useMemo(() => {
    return collection.filter(hasValidStudioImage);
  }, [collection]);

  const spotlightCars = useMemo(() => {
    return stagedCars.length > 0 ? stagedCars : collection;
  }, [stagedCars, collection]);

  // Deterministic daily anchor index based on current date
  const dailyAnchorIdx = useMemo(() => {
    if (spotlightCars.length === 0) return 0;
    const dateHash = getDailyDateHash();
    return Math.abs(dateHash) % spotlightCars.length;
  }, [spotlightCars]);

  const todaysPickCar = useMemo(() => {
    if (spotlightCars.length === 0) return null;
    return spotlightCars[dailyAnchorIdx];
  }, [spotlightCars, dailyAnchorIdx]);

  // Set initial carousel index to Today's Pick on first load without jitter on page refreshes
  useEffect(() => {
    if (spotlightCars.length > 0 && !hasInitializedAnchor.current) {
      setCarouselIdx(dailyAnchorIdx);
      hasInitializedAnchor.current = true;
    }
  }, [spotlightCars, dailyAnchorIdx]);

  const activeCar = spotlightCars.length > 0 ? spotlightCars[carouselIdx % spotlightCars.length] : null;

  const isTodaysPick = Boolean(
    todaysPickCar && activeCar && (
      (todaysPickCar.id && activeCar.id && todaysPickCar.id === activeCar.id) ||
      (carouselIdx % spotlightCars.length === dailyAnchorIdx)
    )
  );

  const changeSpotlightSlide = (direction) => {
    if (spotlightCars.length <= 1 || isFading) return;
    setIsFading(true);
    setTimeout(() => {
      setCarouselIdx((prev) => {
        if (direction === 'next') {
          return (prev + 1) % spotlightCars.length;
        } else {
          return (prev - 1 + spotlightCars.length) % spotlightCars.length;
        }
      });
      setIsFading(false);
    }, 200);
  };

  const handleNextSpotlight = () => changeSpotlightSlide('next');
  const handlePrevSpotlight = () => changeSpotlightSlide('prev');

  // Automated rotation: advance every 7 seconds, pause on hover/touch, reset timer on manual step
  useEffect(() => {
    if (isCarouselPaused || spotlightCars.length <= 1) return;

    const timer = setInterval(() => {
      handleNextSpotlight();
    }, 7000);

    return () => clearInterval(timer);
  }, [isCarouselPaused, spotlightCars.length, carouselIdx, isFading]);

  const renderTypeBadge = (car, size = 'sm') => {
    const type = normalizeVehicleType(car);
    if (type === 'LEGO') {
      return (
        <span className={`inline-flex items-center font-black uppercase tracking-wider rounded ${
          size === 'lg' ? 'px-2 py-0.5 text-xs' : 'px-1.5 py-0.5 text-[10px]'
        } bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.25)]`}>
          🧱 LEGO
        </span>
      );
    }
    if (type === 'Large Scale') {
      return (
        <span className={`inline-flex items-center font-bold uppercase tracking-wider rounded ${
          size === 'lg' ? 'px-2 py-0.5 text-xs' : 'px-1.5 py-0.5 text-[10px]'
        } bg-sky-500/20 text-sky-300 border border-sky-500/30`}>
          Large Scale
        </span>
      );
    }
    if (type === 'Other 1:64') {
      return (
        <span className={`inline-flex items-center font-bold uppercase tracking-wider rounded ${
          size === 'lg' ? 'px-2 py-0.5 text-xs' : 'px-1.5 py-0.5 text-[10px]'
        } bg-zinc-800 text-zinc-300 border border-zinc-700`}>
          1:64 Casting
        </span>
      );
    }
    return (
      <span className={`inline-flex items-center font-bold uppercase tracking-wider rounded ${
        size === 'lg' ? 'px-2 py-0.5 text-xs' : 'px-1.5 py-0.5 text-[10px]'
      } bg-papaya/15 text-papaya border border-papaya/30`}>
        Hot Wheels
      </span>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-carbon text-zinc-100">
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <header className="bg-asphalt border-b border-steel sticky top-0 z-30 px-4 py-3 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img
              src={logoImg}
              alt="Anita's Car Collection Logo"
              className="w-10 h-10 md:w-11 md:h-11 rounded-xl object-cover border border-steel shadow-[0_0_12px_rgba(255,128,0,0.25)] select-none shrink-0"
            />
            <div>
              <h1 className="font-extrabold tracking-wide text-white text-base md:text-lg uppercase">
                Anita's Car Collection
              </h1>
              <p className="text-xs text-zinc-400">Hot Wheels & Die-Cast Garage</p>
            </div>
          </div>
          <button
            onClick={openAddModal}
            className="bg-papaya hover:bg-papayaDark text-black font-bold text-xs md:text-sm px-4 py-2 rounded-lg transition-all flex items-center space-x-1.5 shadow-[0_0_15px_rgba(255,128,0,0.3)] cursor-pointer"
          >
            <Plus size={16} />
            <span>Add Car</span>
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-6xl mx-auto p-4 flex-1 w-full space-y-6">

        {/* Stats Grid */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-asphalt p-4 rounded-xl border border-steel">
            <p className="text-xs uppercase text-zinc-400 font-semibold tracking-wider">Total Collection</p>
            <p className="text-3xl font-black text-papaya mt-1">{typeCounts.total}</p>
          </div>
          <div className="bg-asphalt p-4 rounded-xl border border-steel">
            <p className="text-xs uppercase text-zinc-400 font-semibold tracking-wider">Hot Wheels</p>
            <p className="text-3xl font-black text-white mt-1">{typeCounts.hotWheels}</p>
          </div>
          <div className="bg-asphalt p-4 rounded-xl border border-steel">
            <p className="text-xs uppercase text-zinc-400 font-semibold tracking-wider">LEGO</p>
            <p className="text-3xl font-black text-amber-400 mt-1">{typeCounts.lego}</p>
          </div>
          <div className="bg-asphalt p-4 rounded-xl border border-steel">
            <p className="text-xs uppercase text-zinc-400 font-semibold tracking-wider">Other / Large Castings</p>
            <p className="text-3xl font-black text-zinc-400 mt-1">{typeCounts.other}</p>
          </div>
        </section>

        {/* Carousel Showcase */}
        {collection.length > 0 && activeCar && (
          <section
            onMouseEnter={() => setIsCarouselPaused(true)}
            onMouseLeave={() => setIsCarouselPaused(false)}
            onTouchStart={() => setIsCarouselPaused(true)}
            onTouchEnd={() => setIsCarouselPaused(false)}
            className="bg-asphalt rounded-2xl border border-steel p-5 relative overflow-hidden transition-colors"
          >
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold text-papaya uppercase tracking-wider">Featured Vehicle Spotlight</h2>
                {isCarouselPaused && (
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold border border-steel px-2 py-0.5 rounded-full bg-carbon">
                    Paused
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono font-medium text-zinc-400 bg-carbon px-2.5 py-1 rounded-lg border border-steel flex items-center space-x-1">
                  <span className="text-papaya font-bold">
                    {spotlightCars.length > 0 ? (carouselIdx % spotlightCars.length) + 1 : 0}
                  </span>
                  <span className="text-zinc-600">/</span>
                  <span>{spotlightCars.length}</span>
                  {stagedCars.length > 0 && (
                    <span className="text-[10px] uppercase tracking-wider text-papaya/90 ml-1 font-sans font-bold">
                      Staged
                    </span>
                  )}
                </span>
                <button
                  onClick={() => openEditModal(activeCar)}
                  className="px-3 py-1 bg-steel hover:bg-papaya hover:text-black rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors cursor-pointer"
                >
                  <Edit2 size={13} />
                  <span>Edit</span>
                </button>
                <button
                  onClick={handlePrevSpotlight}
                  className="w-8 h-8 rounded-full bg-steel text-white hover:bg-papaya hover:text-black flex items-center justify-center transition-colors cursor-pointer"
                  title="Previous car"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={handleNextSpotlight}
                  className="w-8 h-8 rounded-full bg-steel text-white hover:bg-papaya hover:text-black flex items-center justify-center transition-colors cursor-pointer"
                  title="Next car"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
            <div
              className={`flex flex-col md:flex-row items-center gap-6 w-full transition-all duration-300 ease-in-out ${
                isFading ? 'opacity-0 scale-[0.98] translate-y-1' : 'opacity-100 scale-100 translate-y-0'
              }`}
            >
              <img
                src={activeCar.imageUrl || getFallbackImage(activeCar.model)}
                alt={activeCar.model}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = getFallbackImage(activeCar.model);
                }}
                className="w-full md:w-1/2 h-52 object-contain rounded-xl bg-carbon border border-steel"
              />
              <div className="flex-1 space-y-2 text-left w-full">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-papaya/20 text-papaya border border-papaya/30">
                    {activeCar.category}
                  </span>
                  {renderTypeBadge(activeCar, 'lg')}
                  {isTodaysPick && (
                    <span className="inline-flex items-center space-x-1 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.25)] animate-pulse">
                      <Sparkles size={11} className="text-amber-400" />
                      <span>Today's Pick</span>
                    </span>
                  )}
                </div>
                <h3 className="text-2xl font-black text-white">{activeCar.brand} {activeCar.model}</h3>
                <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400 pt-2 border-t border-steel">
                  <div>Colour: <span className="text-white">{activeCar.colour}</span></div>
                  <div>Origin: <span className="text-white">{activeCar.country}</span></div>
                  <div>Type: <span className="text-white font-medium">{normalizeVehicleType(activeCar)}</span></div>
                  <div>Garage ID: <span className="text-white">#{activeCar.id}</span></div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Filter Controls */}
        <section className="flex flex-col md:flex-row gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search model, brand, or colour..."
            className="flex-1 bg-asphalt border border-steel rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-papaya"
          />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-asphalt border border-steel rounded-xl px-3 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-papaya"
          >
            <option value="">All Categories</option>
            {ALLOWED_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-asphalt border border-steel rounded-xl px-3 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-papaya"
          >
            <option value="">All Types</option>
            <option value="Hot Wheels">Hot Wheels</option>
            <option value="LEGO">LEGO</option>
            <option value="Large Scale">Large Scale</option>
            <option value="Other 1:64">Other 1:64</option>
          </select>
        </section>

        {/* Cars Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCars.map((car) => (
            <div key={car.id} className="bg-asphalt border border-steel rounded-xl p-3.5 flex flex-col justify-between hover:border-papaya/50 transition-all relative group">
              <div className="relative">
                <img
                  src={car.imageUrl || getFallbackImage(car.model)}
                  alt={car.model}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = getFallbackImage(car.model);
                  }}
                  className="w-full h-36 object-contain rounded-lg bg-carbon mb-3"
                />
                <button
                  onClick={() => openEditModal(car)}
                  className="absolute top-2 right-2 bg-carbon/90 border border-steel hover:border-papaya text-zinc-300 hover:text-papaya p-1.5 rounded-lg opacity-80 group-hover:opacity-100 transition-opacity cursor-pointer"
                  title="Edit car details or photo"
                >
                  <Edit2 size={14} />
                </button>
              </div>
              <div>
                <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
                  <span className="font-semibold text-zinc-300 truncate max-w-[120px]">{car.brand}</span>
                  {renderTypeBadge(car, 'sm')}
                </div>
                <h4 className="font-bold text-white text-sm mb-2">{car.model}</h4>
                <div className="flex justify-between items-center text-xs text-zinc-400 pt-2 border-t border-steel/60">
                  <span>{car.colour}</span>
                  <span className="text-papaya font-semibold text-[11px]">
                    {car.category}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </section>
      </main>

      {/* Modal (Add / Edit) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-asphalt border border-steel rounded-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-steel pb-3">
              <h3 className="font-bold text-white uppercase tracking-wider text-sm">
                {isEditMode ? 'Edit Vehicle Details' : 'Add New Vehicle'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  {isEditMode ? 'Replace Vehicle Photo (Optional)' : 'Vehicle Photo (Required)'}
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleMainPhotoChange}
                  disabled={isRenderingNanoBanana}
                  className="text-xs text-zinc-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-steel file:text-white hover:file:bg-papaya hover:file:text-black cursor-pointer w-full disabled:opacity-50"
                />
              </div>

              {!isEditMode && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Base Stamp Photo (Optional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleStampPhotoChange}
                    disabled={isRenderingNanoBanana}
                    className="text-xs text-zinc-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-steel file:text-white hover:file:bg-papaya hover:file:text-black cursor-pointer w-full disabled:opacity-50"
                  />
                </div>
              )}

              {isRenderingNanoBanana && (
                <div className="flex items-center space-x-2.5 text-xs text-papaya bg-carbon p-3.5 rounded-xl border border-steel shadow-[0_0_15px_rgba(255,128,0,0.15)] animate-pulse">
                  <Loader2 size={18} className="animate-spin text-papaya shrink-0" />
                  <span className="font-semibold">Nano Banana 2 is creating studio staging...</span>
                </div>
              )}

              {normalisedPreview && (
                <div className="space-y-2.5 pt-1">
                  <div className="flex gap-3 items-center">
                    <img
                      src={normalisedPreview}
                      alt="Studio Preview"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = getFallbackImage(extractedData?.model || 'Preview');
                      }}
                      className="w-28 h-20 object-cover rounded-lg border border-steel bg-black shadow-md"
                    />
                    <div className="flex flex-col text-[11px] text-zinc-400 space-y-1">
                      <span className="text-zinc-200 font-medium">Studio lighting applied</span>
                      {isEditMode && (
                        <button
                          type="button"
                          onClick={handleRemovePhoto}
                          className="text-xs text-red-400 hover:text-red-300 flex items-center space-x-1 cursor-pointer font-medium"
                        >
                          <Trash2 size={12} />
                          <span>Remove Photo from Vehicle</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleRegenerateStudioStaging}
                    disabled={isRenderingNanoBanana || isScanning}
                    className="w-full bg-asphalt hover:bg-steel border border-papaya/50 hover:border-papaya text-papaya hover:text-white font-bold py-2 px-3 rounded-xl transition-all text-xs flex items-center justify-center space-x-2 cursor-pointer shadow-[0_0_12px_rgba(255,128,0,0.15)] disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={isRenderingNanoBanana ? 'animate-spin' : ''} />
                    <span>{isRenderingNanoBanana ? 'Nano Banana 2 is creating studio staging...' : 'Regenerate Studio Staging'}</span>
                  </button>
                </div>
              )}

              {isEditMode && removeImage && (
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-red-950/40 border border-red-900/60 text-xs text-red-200">
                  <span>Photo will be cleared from vehicle upon saving</span>
                  <button
                    type="button"
                    onClick={() => {
                      setRemoveImage(false);
                      const originalCar = collection.find((c) => c.id === editingCarId);
                      if (originalCar?.imageUrl) {
                        setNormalisedPreview(originalCar.imageUrl);
                        setExtractedData((prev) => ({ ...prev, imageUrl: originalCar.imageUrl }));
                      }
                    }}
                    className="underline hover:text-white cursor-pointer ml-2"
                  >
                    Undo
                  </button>
                </div>
              )}

              {isEditMode && !removeImage && !normalisedPreview && extractedData?.imageUrl && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="inline-flex items-center space-x-1 text-xs text-red-400 hover:text-red-300 py-1 cursor-pointer font-medium"
                >
                  <Trash2 size={12} />
                  <span>Remove Photo from Vehicle</span>
                </button>
              )}
            </div>

            {!isEditMode && !extractedData ? (
              <button
                onClick={scanWithGemini}
                disabled={isScanning || isRenderingNanoBanana || !mainPhoto}
                className="w-full bg-papaya hover:bg-papayaDark disabled:opacity-50 text-black font-bold py-2.5 rounded-xl transition-all uppercase tracking-wider text-xs flex items-center justify-center space-x-2 cursor-pointer"
              >
                <Sparkles size={16} />
                <span>{isScanning ? 'Analysing Casting...' : 'Scan with Gemini 3.8 Flash'}</span>
              </button>
            ) : null}

            {(isEditMode || extractedData) && (
              <div className="border-t border-steel pt-4 space-y-3">
                <p className="text-xs font-bold text-zinc-400 uppercase">Attributes</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-zinc-400">Brand</label>
                    <input
                      type="text"
                      value={extractedData?.brand || ''}
                      onChange={(e) => setExtractedData({ ...extractedData, brand: e.target.value })}
                      className="w-full bg-carbon border border-steel rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-400">Model</label>
                    <input
                      type="text"
                      value={extractedData?.model || ''}
                      onChange={(e) => setExtractedData({ ...extractedData, model: e.target.value })}
                      className="w-full bg-carbon border border-steel rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-400">Colour</label>
                    <input
                      type="text"
                      value={extractedData?.colour || ''}
                      onChange={(e) => setExtractedData({ ...extractedData, colour: e.target.value })}
                      className="w-full bg-carbon border border-steel rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-400">Country</label>
                    <input
                      type="text"
                      value={extractedData?.country || ''}
                      onChange={(e) => setExtractedData({ ...extractedData, country: e.target.value })}
                      className="w-full bg-carbon border border-steel rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-zinc-400">Category</label>
                  <select
                    value={extractedData?.category || 'Sports Car'}
                    onChange={(e) => setExtractedData({ ...extractedData, category: e.target.value })}
                    className="w-full bg-carbon border border-steel rounded-lg px-2.5 py-1.5 text-xs text-white"
                  >
                    {ALLOWED_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-zinc-400">Scale / Vehicle Type</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-1">
                    {ALLOWED_TYPES.map((t) => {
                      const isSelected = (extractedData?.type || 'Hot Wheels') === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setExtractedData({ ...extractedData, type: t })}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer text-center ${
                            isSelected
                              ? (t === 'LEGO'
                                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.25)]'
                                  : 'bg-papaya/20 border-papaya text-papaya shadow-[0_0_10px_rgba(255,128,0,0.25)]')
                              : 'bg-carbon border-steel text-zinc-400 hover:text-white hover:border-zinc-500'
                          }`}
                        >
                          {t === 'LEGO' ? '🧱 LEGO' : t}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={handleSaveCar}
                  disabled={isSaving || isRenderingNanoBanana}
                  className="w-full bg-white hover:bg-zinc-200 disabled:opacity-50 text-black font-bold py-2 rounded-xl transition-all text-xs uppercase flex items-center justify-center space-x-1 cursor-pointer mt-2"
                >
                  <Check size={16} />
                  <span>{isSaving ? 'Updating...' : (isEditMode ? 'Update Vehicle' : 'Save to Collection')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}