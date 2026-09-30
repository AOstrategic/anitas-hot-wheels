import React, { useState, useEffect, useRef } from 'react';
import { Plus, ChevronLeft, ChevronRight, X, Sparkles, Check, Edit2, Camera } from 'lucide-react';

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

export default function App() {
  const [collection, setCollection] = useState([]);
  const [stats, setStats] = useState({ total: 0, brands: 0, hotWheels: 0, nonHotWheels: 0 });
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedHw, setSelectedHw] = useState('');
  const [carouselIdx, setCarouselIdx] = useState(0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingCarId, setEditingCarId] = useState(null);

  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [mainPhoto, setMainPhoto] = useState(null);
  const [stampPhoto, setStampPhoto] = useState(null);
  const [normalisedPreview, setNormalisedPreview] = useState(null);
  const [extractedData, setExtractedData] = useState({
    brand: '',
    model: '',
    colour: '',
    country: '',
    category: 'Sports Car',
    hot_wheels: 'Yes',
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
        setCollection(data.cars);
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to load collection:', err);
    }
  };

  const normaliseImage = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current || document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 400;
        const ctx = canvas.getContext('2d');

        const grad = ctx.createRadialGradient(300, 200, 50, 300, 200, 300);
        grad.addColorStop(0, '#262626');
        grad.addColorStop(1, '#141414');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const hRatio = canvas.width / img.width;
        const vRatio = canvas.height / img.height;
        const ratio = Math.min(hRatio, vRatio) * 0.85;
        const shiftX = (canvas.width - img.width * ratio) / 2;
        const shiftY = (canvas.height - img.height * ratio) / 2;

        ctx.drawImage(img, 0, 0, img.width, img.height, shiftX, shiftY, img.width * ratio, img.height * ratio);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setNormalisedPreview(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleMainPhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setMainPhoto(file);
      normaliseImage(file);
    }
  };

  const handleStampPhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setStampPhoto(file);
    }
  };

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = (error) => reject(error);
    });

  const scanWithGemini = async () => {
    if (!mainPhoto || !GEMINI_KEY) {
      alert('Vehicle photo and Gemini API key are required.');
      return;
    }

    setIsScanning(true);
    try {
      const mainBase64 = await toBase64(mainPhoto);
      const parts = [
        { text: "Examine the die-cast car photo(s). Extract the technical details strictly matching the schema." },
        { inline_data: { mime_type: "image/jpeg", data: mainBase64 } }
      ];

      if (stampPhoto) {
        const stampBase64 = await toBase64(stampPhoto);
        parts.push({ inline_data: { mime_type: "image/jpeg", data: stampBase64 } });
      }

      const promptSystem = "You are an expert Hot Wheels and die-cast vehicle archivist. Extract details for the car database:\n" +
        "- Brand: Vehicle manufacturer.\n" +
        "- Model: Full model name.\n" +
        "- Colour: Dominant body paint colour.\n" +
        "- Country: Origin country of the car brand.\n" +
        "- Category: Choose strictly one of: " + ALLOWED_CATEGORIES.join(', ') + ".\n" +
        "- Hot Wheels: 'Yes' if authentic Mattel Hot Wheels, otherwise 'No'.\n" +
        "- Confidence: Short summary of visual clues and markings.";

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
                hot_wheels: { type: "STRING", enum: ["Yes", "No"] },
                confidence_notes: { type: "STRING" }
              },
              required: ["brand", "model", "colour", "country", "category", "hot_wheels"]
            }
          }
        })
      });

      const json = await res.json();
      const parsed = JSON.parse(json.candidates[0].content.parts[0].text);
      setExtractedData(parsed);
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
    setNormalisedPreview(null);
    setExtractedData(null);
    setIsModalOpen(true);
  };

  const openEditModal = (car) => {
    setIsEditMode(true);
    setEditingCarId(car.id);
    setMainPhoto(null);
    setStampPhoto(null);
    setNormalisedPreview(car.imageUrl || null);
    setExtractedData({
      brand: car.brand,
      model: car.model,
      colour: car.colour,
      country: car.country,
      category: car.category,
      hot_wheels: car.hotWheels,
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
      const payload = {
        action: isEditMode ? 'update' : 'create',
        id: editingCarId,
        brand: extractedData.brand,
        model: extractedData.model,
        colour: extractedData.colour,
        country: extractedData.country,
        category: extractedData.category,
        hotWheels: extractedData.hot_wheels,
        imageUrl: extractedData.imageUrl || '',
        imageBase64: (normalisedPreview && normalisedPreview.startsWith('data:image')) ? normalisedPreview : ''
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
      fetchCollection();
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredCars = collection.filter((c) => {
    const matchesSearch = !search ||
      c.model.toLowerCase().includes(search.toLowerCase()) ||
      c.brand.toLowerCase().includes(search.toLowerCase()) ||
      c.colour.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !selectedCategory || c.category === selectedCategory;
    const matchesHw = !selectedHw || c.hotWheels === selectedHw;
    return matchesSearch && matchesCategory && matchesHw;
  });

  const activeCar = collection[carouselIdx];

  return (
    <div className="min-h-screen flex flex-col bg-carbon text-zinc-100">
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <header className="bg-asphalt border-b border-steel sticky top-0 z-30 px-4 py-3 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-papaya flex items-center justify-center font-black text-black text-lg select-none">
              A
            </div>
            <div>
              <h1 className="font-extrabold tracking-wide text-white text-base md:text-lg uppercase">
                Anita's Car Collection
              </h1>
              <p className="text-xs text-zinc-400">Hot Wheels Garage</p>
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
            <p className="text-3xl font-black text-papaya mt-1">{stats.total}</p>
          </div>
          <div className="bg-asphalt p-4 rounded-xl border border-steel">
            <p className="text-xs uppercase text-zinc-400 font-semibold tracking-wider">Unique Brands</p>
            <p className="text-3xl font-black text-white mt-1">{stats.brands}</p>
          </div>
          <div className="bg-asphalt p-4 rounded-xl border border-steel">
            <p className="text-xs uppercase text-zinc-400 font-semibold tracking-wider">Hot Wheels</p>
            <p className="text-3xl font-black text-white mt-1">{stats.hotWheels}</p>
          </div>
          <div className="bg-asphalt p-4 rounded-xl border border-steel">
            <p className="text-xs uppercase text-zinc-400 font-semibold tracking-wider">Other Castings</p>
            <p className="text-3xl font-black text-zinc-400 mt-1">{stats.nonHotWheels}</p>
          </div>
        </section>

        {/* Carousel Showcase */}
        {collection.length > 0 && activeCar && (
          <section className="bg-asphalt rounded-2xl border border-steel p-5 relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-papaya uppercase tracking-wider">Featured Vehicle Spotlight</h2>
              <div className="flex space-x-2">
                <button
                  onClick={() => openEditModal(activeCar)}
                  className="px-3 py-1 bg-steel hover:bg-papaya hover:text-black rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors"
                >
                  <Edit2 size={13} />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => setCarouselIdx((prev) => (prev - 1 + collection.length) % collection.length)}
                  className="w-8 h-8 rounded-full bg-steel text-white hover:bg-papaya hover:text-black flex items-center justify-center transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setCarouselIdx((prev) => (prev + 1) % collection.length)}
                  className="w-8 h-8 rounded-full bg-steel text-white hover:bg-papaya hover:text-black flex items-center justify-center transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
            <div className="flex flex-col md:flex-row items-center gap-6 w-full">
              <img
                src={activeCar.imageUrl || `https://placehold.co/600x400/1C1C1C/FF8000?text=${encodeURIComponent(activeCar.model)}`}
                alt={activeCar.model}
                className="w-full md:w-1/2 h-52 object-contain rounded-xl bg-carbon border border-steel"
              />
              <div className="flex-1 space-y-2 text-left w-full">
                <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-papaya/20 text-papaya border border-papaya/30">
                  {activeCar.category}
                </span>
                <h3 className="text-2xl font-black text-white">{activeCar.brand} {activeCar.model}</h3>
                <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400 pt-2 border-t border-steel">
                  <div>Colour: <span className="text-white">{activeCar.colour}</span></div>
                  <div>Origin: <span className="text-white">{activeCar.country}</span></div>
                  <div>Hot Wheels: <span className="text-white">{activeCar.hotWheels}</span></div>
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
            value={selectedHw}
            onChange={(e) => setSelectedHw(e.target.value)}
            className="bg-asphalt border border-steel rounded-xl px-3 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-papaya"
          >
            <option value="">All Types</option>
            <option value="Yes">Hot Wheels Only</option>
            <option value="No">Other Castings</option>
          </select>
        </section>

        {/* Cars Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCars.map((car) => (
            <div key={car.id} className="bg-asphalt border border-steel rounded-xl p-3.5 flex flex-col justify-between hover:border-papaya/50 transition-all relative group">
              <div className="relative">
                <img
                  src={car.imageUrl || `https://placehold.co/400x250/1C1C1C/FF8000?text=${encodeURIComponent(car.model)}`}
                  alt={car.model}
                  className="w-full h-36 object-contain rounded-lg bg-carbon mb-3"
                />
                <button
                  onClick={() => openEditModal(car)}
                  className="absolute top-2 right-2 bg-carbon/90 border border-steel hover:border-papaya text-zinc-300 hover:text-papaya p-1.5 rounded-lg opacity-80 group-hover:opacity-100 transition-opacity"
                  title="Edit car details or photo"
                >
                  <Edit2 size={14} />
                </button>
              </div>
              <div>
                <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
                  <span>{car.brand}</span>
                  <span className="text-papaya font-semibold">{car.category}</span>
                </div>
                <h4 className="font-bold text-white text-sm mb-2">{car.model}</h4>
                <div className="flex justify-between items-center text-xs text-zinc-400 pt-2 border-t border-steel/60">
                  <span>{car.colour}</span>
                  <span className={car.hotWheels === 'Yes' ? 'text-papaya font-semibold' : 'text-zinc-500'}>
                    {car.hotWheels === 'Yes' ? 'HW Authenticated' : 'Other Casting'}
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
                {isEditMode ? 'Edit Vehicle Details' : 'Add New Hot Wheels'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-white">
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
                  className="text-xs text-zinc-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-steel file:text-white hover:file:bg-papaya hover:file:text-black cursor-pointer w-full"
                />
              </div>

              {!isEditMode && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Base Stamp Photo (Optional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleStampPhotoChange}
                    className="text-xs text-zinc-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-steel file:text-white hover:file:bg-papaya hover:file:text-black cursor-pointer w-full"
                  />
                </div>
              )}

              {normalisedPreview && (
                <div className="flex gap-2 pt-1 items-center">
                  <img src={normalisedPreview} alt="Studio Preview" className="w-28 h-20 object-cover rounded-lg border border-steel bg-black" />
                  <span className="text-[11px] text-zinc-400">Studio lighting applied</span>
                </div>
              )}
            </div>

            {!isEditMode && !extractedData ? (
              <button
                onClick={scanWithGemini}
                disabled={isScanning || !mainPhoto}
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
                  <label className="text-[11px] text-zinc-400">Hot Wheels Certified?</label>
                  <select
                    value={extractedData?.hot_wheels || 'Yes'}
                    onChange={(e) => setExtractedData({ ...extractedData, hot_wheels: e.target.value })}
                    className="w-full bg-carbon border border-steel rounded-lg px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>

                <button
                  onClick={handleSaveCar}
                  disabled={isSaving}
                  className="w-full bg-white hover:bg-zinc-200 text-black font-bold py-2 rounded-xl transition-all text-xs uppercase flex items-center justify-center space-x-1 cursor-pointer"
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