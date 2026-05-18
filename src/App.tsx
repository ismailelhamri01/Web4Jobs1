/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Sparkles, 
  LayoutList, 
  CalendarDays, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  X, 
  Loader2,
  ChevronRight,
  ChevronDown,
  ChevronsUpDown,
  Globe,
  LogIn,
  Plus,
  Pencil,
  Trash2,
  Save,
  Download,
  Mail,
  MessageCircle,
  Linkedin,
  Send,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Logo } from './components/Logo';

// --- Types ---
interface Cohort {
  id: string;
  ville: string;
  phase: string;
  etape: string;
  debut: string;
  fin: string;
  avancement: number;
  statut: 'Non démarré' | 'En cours' | 'Terminé' | 'Décalé' | 'Fin de phase' | 'Démarrage' | 'Clôture';
  actions: string;
  parcours?: string;
  sousEtape?: string;
}

type Tab = 'table' | 'gantt' | 'project' | 'manage';

interface CertificationAverage {
  average: number;
  averageRounded: number;
  count: number;
}

interface CityProgress {
  city: string;
  average: number;
  averageRounded: number;
  progress: number;
  count: number;
  status: 'En cours' | 'Terminé';
}

interface SheetSyncConfig {
  city: string;
  spreadsheetId: string;
  gid: string;
  url: string;
}

// --- Constants ---
const COHORTS: Cohort[] = [
  { id: "C1 - Tinghir Promo 1", ville: "Tinghir", phase: "Phase 5 : Clôture du projet", etape: "Clôture administrative", debut: "2026-01-05", fin: "2026-07-31", avancement: 1.0, statut: "Terminé", actions: "Taux d'installation > 70%. Valider les certifications finales." },
  { id: "C2 - Essaouira", ville: "Essaouira", phase: "Phase 4 : Insertion et autonomisation", etape: "Mise en pratique et insertion professionnelle", debut: "2025-01-06", fin: "2025-07-31", avancement: 0.8, statut: "En cours", actions: "Mise en pratique : Préparation CV, candidatures et entretiens." },
  { id: "C3 - Témara", ville: "Témara", phase: "Phase 4 : Insertion et autonomisation", etape: "Mise en pratique et insertion professionnelle", debut: "2026-01-15", fin: "2026-06-30", avancement: 0.7, statut: "En cours", actions: "Mise en pratique : Création statut auto-entrepreneur et profils plateformes." },
  { id: "C4 - Aïn Aouda", ville: "Aïn Aouda", phase: "Phase 4 : Insertion et autonomisation", etape: "Accompagnement et renforcement des capacités", debut: "2026-01-15", fin: "2026-06-30", avancement: 0.65, statut: "En cours", actions: "Accompagnement : Formations complémentaires et ateliers pratiques." },
  { id: "C5 - Es-Semara", ville: "Es-Semara", phase: "Phase 3 : Certification", etape: "P1 - Front End Development Libraries Certification", debut: "2025-09-08", fin: "2026-05-31", avancement: 0.45, statut: "En cours", actions: "Suivi des steps et des mini-projets de certification.", parcours: "Web Developer & Solution" },
  { id: "C6 - Tinghir Promo 2", ville: "Tinghir", phase: "Phase 3 : Certification", etape: "P1 - Responsive Web Design Certification", debut: "2025-09-18", fin: "2026-05-31", avancement: 0.4, statut: "En cours", actions: "Même niveau d'avancement que Es-Semara et Laayoune.", parcours: "Web Developer & Solution" },
  { id: "C7 - Tan-Tan", ville: "Tan-Tan", phase: "Phase 2 : Orientation", etape: "Validation du parcours", debut: "2026-02-08", fin: "2026-06-07", avancement: 0.35, statut: "En cours", actions: "Gestion du décalage d'une semaine sur le calendrier." },
  { id: "C8 - Laayoune", ville: "Laayoune", phase: "Phase 2 : Orientation", etape: "Choix du parcours", debut: "2026-02-01", fin: "2026-05-31", avancement: 0.3, statut: "En cours", actions: "Avancement synchronisé avec Tinghir P2 et Es-Semara." },
  { id: "C9 - Sidi Kacem", ville: "Sidi Kacem", phase: "Phase 1 : Tronc commun", etape: "Module 6 – Projets de fin d’études", debut: "2025-12-01", fin: "2026-03-29", avancement: 0.2, statut: "En cours", actions: "Finalisation projets cette sem., soutenances sem. prochaine." },
  { id: "C10 - Nador Promo 1", ville: "Nador", phase: "Phase 0 : Lancement du projet", etape: "Démarrage officiel", debut: "2026-02-25", fin: "2026-04-30", avancement: 0.1, statut: "En cours", actions: "Atteindre Module 3 cette semaine. Maintenir l'engagement." }
];

const TIME_MIN = new Date('2025-01-01').getTime();
const TIME_MAX = new Date('2026-10-31').getTime();
const TOTAL_DURATION = TIME_MAX - TIME_MIN;
const QUARTERS = ['T1 2025', 'T2 2025', 'T3 2025', 'T4 2025', 'T1 2026', 'T2 2026', 'T3 2026', 'T4 2026'];

const PHASE_STEPS: Record<string, string[]> = {
  "Phase 0 : Lancement du projet": [
    "Préparation du projet",
    "Mobilisation des ressources",
    "Démarrage officiel"
  ],
  "Phase 1 : Tronc commun": [
    "Module 1",
    "Module 2",
    "Module 3",
    "Module 4",
    "Module 5",
    "Module 6 – Projets de fin d’études",
    "Présentation des projets de fin d’études",
    "Tests d’évaluation"
  ],
  "Phase 2 : Orientation": [
    "Identification des profils",
    "Choix du parcours",
    "Validation du parcours"
  ],
  "Phase 3 : Certification": [
    "P1 - Responsive Web Design Certification",
    "P1 - Front End Development Libraries Certification",
    "P1 - Back End Development and APIs Certification",
    "P1 - Projet final",
    "P2 - Data Visualization Certification",
    "P2 - Relational Database Certification",
    "P2 - Data Analysis with Python Certification",
    "P2 - Projet final",
    "P3 - Information Security Certification",
    "P3 - Web security Certification",
    "P3 - Network Security Certification",
    "P3 - Projet final",
    "P4 - Fondamentaux No/Low code",
    "P4 - Automatisation No/Low code",
    "P4 - Applications No/Low code",
    "P4 - Projet final"
  ],
  "Phase 4 : Insertion et autonomisation": [
    "Orientation et choix du mode d’insertion",
    "Accompagnement et renforcement des capacités",
    "Mise en pratique et insertion professionnelle"
  ],
  "Phase 5 : Clôture du projet": [
    "Bilan du projet",
    "Évaluation finale",
    "Clôture administrative"
  ]
};

const ALL_STEPS = Object.values(PHASE_STEPS).flat();

const SHEET_SYNC_STORAGE_KEY = 'web4jobs_sheet_sync_config';

const extractSpreadsheetId = (value: string) => {
  const trimmed = value.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match?.[1]) return match[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;
  return "";
};

const extractSheetGid = (value: string) => {
  try {
    const url = new URL(value.trim());
    return url.searchParams.get("gid") || "";
  } catch {
    const match = value.match(/[?#&]gid=(\d+)/);
    return match?.[1] || "";
  }
};

const getProgressFromStep = (step: string, parcours?: string) => {
  const relevantSteps: string[] = [];
  Object.keys(PHASE_STEPS).forEach(p => {
    if (p === "Phase 3 : Certification") {
      const pk = parcours || "Web Developer & Solution";
      relevantSteps.push(...PHASE_STEPS[p]); 
    } else {
      relevantSteps.push(...PHASE_STEPS[p]);
    }
  });
  const index = relevantSteps.indexOf(step);
  if (index === -1) return 0;
  return Math.round(((index + 1) / relevantSteps.length) * 100) / 100;
};

const getStatusFromProgress = (progress: number) => {
  if (progress >= 0.7) return "Terminé";
  return "En cours";
};

const formatDate = (str: string) => {
  if (!str) return "";
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
};

const getStatusKey = (status: string) => {
  switch (status) {
    case 'En cours': return 'inProgress';
    case 'Terminé': return 'completed';
    case 'Décalé': return 'delayed';
    case 'Non démarré': return 'notStarted';
    case 'Fin de phase': return 'phaseEnd';
    case 'Démarrage': return 'starting';
    case 'Clôture': return 'closure';
    default: return 'planned';
  }
};

const normalizeCityName = (name: string): string => {
  if (!name) return "INCONNU";
  let trimmed = name.trim();
  if (!trimmed || trimmed.toUpperCase() === "INCONNU" || trimmed.toUpperCase() === "UNKNOWN") return "INCONNU";
  
  const upper = trimmed.toUpperCase();
  if (upper === "AÏN" || upper === "AIN") trimmed = "Aïn Aouda";
  if (upper === "SIDI") trimmed = "Sidi Kacem";
  
  return trimmed.split(/([\s-/])/).map(part => {
    if (part.length === 0 || /[\s-/]/.test(part)) return part;
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  }).join('');
};

const extractCityFromId = (id: string): string => {
  if (!id) return "INCONNU";
  const parts = id.split(/\s*-\s*/);
  if (parts.length < 2) {
    const trimmedId = id.trim();
    if (trimmedId.length > 0 && !trimmedId.startsWith('C')) {
      return normalizeCityName(trimmedId);
    }
    return "INCONNU";
  }
  let cityPart = parts[1].trim();
  cityPart = cityPart.replace(/\s*Promo\s*\d+\s*$/i, "").trim();
  return normalizeCityName(cityPart);
};

const getPhaseStyles = (phase: string) => {
  const p = phase.toLowerCase();
  if (p.includes("phase 0") || p.includes("lancement")) return { badge: "bg-slate-100 text-slate-700 border-slate-200", bar: "bg-slate-400" };
  if (p.includes("phase 1") || p.includes("tronc commun")) return { badge: "bg-amber-100 text-amber-700 border-amber-200", bar: "bg-amber-400" };
  if (p.includes("phase 2") || p.includes("orientation")) return { badge: "bg-blue-100 text-blue-700 border-blue-200", bar: "bg-blue-400" };
  if (p.includes("phase 3") || p.includes("certification")) return { badge: "bg-indigo-100 text-indigo-700 border-indigo-200", bar: "bg-indigo-400" };
  if (p.includes("phase 4") || p.includes("insertion")) return { badge: "bg-emerald-100 text-emerald-700 border-emerald-200", bar: "bg-emerald-400" };
  if (p.includes("phase 5") || p.includes("clôture")) return { badge: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200", bar: "bg-fuchsia-400" };
  return { badge: "bg-gray-100 text-gray-700 border-gray-200", bar: "bg-gray-400" };
};

const getPhaseTranslationKey = (phase: string) => {
  if (!phase) return "";
  const p = phase.toLowerCase();
  if (p.includes("phase 0") || p.includes("lancement")) return "Phase 0 : Lancement du projet";
  if (p.includes("phase 1") || p.includes("tronc commun")) return "Phase 1 : Tronc commun";
  if (p.includes("phase 2") || p.includes("orientation")) return "Phase 2 : Orientation";
  if (p.includes("phase 3") || p.includes("certification")) return "Phase 3 : Certification";
  if (p.includes("phase 4") || p.includes("insertion")) return "Phase 4 : Insertion et autonomisation";
  if (p.includes("phase 5") || p.includes("clôture") || p.includes("cloture")) return "Phase 5 : Clôture du projet";
  return phase;
};

export default function App() {
  const { t, i18n } = useTranslation();
  const [cohorts, setCohorts] = useState<Cohort[]>(() => {
    const saved = localStorage.getItem('web4jobs_cohorts');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.map((c: any) => {
        let currentVille = c.ville;
        if (!currentVille || currentVille.toUpperCase() === "INCONNU" || currentVille.toUpperCase() === "UNKNOWN") {
          currentVille = extractCityFromId(c.id);
        } else {
          currentVille = normalizeCityName(currentVille);
        }
        return { ...c, ville: currentVille };
      });
    }
    return COHORTS.map(c => ({ ...c, ville: normalizeCityName(c.ville) }));
  });

  useEffect(() => {
    localStorage.setItem('web4jobs_cohorts', JSON.stringify(cohorts));
  }, [cohorts]);

  const [activeTab, setActiveTab] = useState<Tab>('project');
  const [activeSheetSync, setActiveSheetSync] = useState<SheetSyncConfig | null>(() => {
    try {
      const saved = localStorage.getItem(SHEET_SYNC_STORAGE_KEY);
      return saved ? JSON.parse(saved) as SheetSyncConfig : null;
    } catch {
      return null;
    }
  });

  const [sheetUrlInput, setSheetUrlInput] = useState(() => {
    try {
      const saved = localStorage.getItem(SHEET_SYNC_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as SheetSyncConfig).url || "" : "";
    } catch {
      return "";
    }
  });

  const [sheetSyncCity, setSheetSyncCity] = useState("");
  const [sheetSyncMessage, setSheetSyncMessage] = useState<string | null>(null);
  const [isCertificationAverageLoading, setIsCertificationAverageLoading] = useState(true);
  const [certificationAverageError, setCertificationAverageError] = useState<string | null>(null);
  const [certificationAverage, setCertificationAverage] = useState<CertificationAverage | null>(null);
  const [filterCity, setFilterCity] = useState("");

  // --- 🛠️ تحديث جلب البيانات ديريكت من كلاينت جوجل شيتس (بدون سيرفر إكسبريس) ---
  useEffect(() => {
    let isMounted = true;
    let hasLoaded = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    const loadCityProgress = async () => {
      if (!hasLoaded) {
        setIsCertificationAverageLoading(true);
      }
      setCertificationAverageError(null);

      try {
        const spreadsheetId = activeSheetSync?.spreadsheetId || "1Fjyjid85m8CulFOWNgvyL66a4lZ2DiM4H3KN37vysI8";
        // ⚠️ ملاحظة: قم بتعويض هذا المفتاح بمفتاح Google Sheets API الحقيقي الخاص بك
        const apiKey = "AIzaSyD-YOUR_REAL_GOOGLE_API_KEY_HERE"; 

        // 1. جلب الـ Metadata لمعرفة أحدث تبويب (أحدث تاريخ) تلقائياً
        const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?key=${apiKey}`;
        const metaResponse = await fetch(metaUrl);
        if (!metaResponse.ok) throw new Error(t('sheets.error'));
        
        const metaData = await metaResponse.json() as any;
        const tabNames = metaData.sheets?.map((s: any) => s.properties?.title) || [];
        const latestTab = tabNames[tabNames.length - 1] || "Sheet1";

        // 2. جلب أسطر البيانات من التبويب الأخير
        const dataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(latestTab)}?key=${apiKey}&majorDimension=ROWS`;
        const dataResponse = await fetch(dataUrl);
        if (!dataResponse.ok) throw new Error(t('sheets.error'));
        
        const dataPayload = await dataResponse.json() as any;
        const rows = dataPayload.values || [];

        if (rows.length > 1) {
          // حساب المعدل الإجمالي والنسب ديريكت من الأسطر القادمة من Sheets
          let totalProgress = 0;
          let validStudentsCount = 0;

          // تخطي سطر العناوين (row 0) وحساب القيم التابعة لعمود التقدّم
          rows.slice(1).forEach((row: any) => {
            const progressValue = parseFloat(row[4]); // يفترض أن النسبة بالعمود الخامس E
            if (!isNaN(progressValue)) {
              totalProgress += progressValue;
              validStudentsCount++;
            }
          });

          // إن لم تكن النسبة مئوية بالكامل، نضرب بـ 100
          const calculatedAverage = validStudentsCount > 0 ? (totalProgress / validStudentsCount) * 100 : 0;

          if (isMounted) {
            setCertificationAverage({
              average: calculatedAverage,
              averageRounded: Math.round(calculatedAverage),
              count: validStudentsCount,
            });

            setSheetSyncMessage(
              activeSheetSync 
                ? `${activeSheetSync.city} : ${Math.round(calculatedAverage)}%`
                : null
            );

            // تحديث قيم الـ Cohorts أوتوماتيكياً فـ الواجهة
            setCohorts((previousCohorts) => {
              return previousCohorts.map((cohort) => {
                const targetCity = activeSheetSync?.city || "Sidi Kacem";
                if (normalizeCityName(cohort.ville) === normalizeCityName(targetCity)) {
                  const roundedProgress = Math.round(calculatedAverage) / 100;
                  return {
                    ...cohort,
                    avancement: roundedProgress,
                    statut: getStatusFromProgress(roundedProgress) as Cohort['statut'],
                  };
                }
                return cohort;
              });
            });
          }
        }
      } catch (error) {
        if (isMounted) {
          setCertificationAverage(null);
          setCertificationAverageError(error instanceof Error ? error.message : t('sheets.error'));
          setSheetSyncMessage(null);
        }
      } finally {
        if (isMounted) {
          setIsCertificationAverageLoading(false);
          hasLoaded = true;
        }
      }
    };

    loadCityProgress();
    intervalId = setInterval(loadCityProgress, 10000); // التحديث الدوري كل 10 ثوانٍ

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [activeSheetSync, t]);

  const cities = useMemo(() => {
    return Array.from(new Set(cohorts.map(c => normalizeCityName(c.ville)))).sort();
  }, [cohorts]);

  useEffect(() => {
    if (!sheetSyncCity && cities.length > 0) {
      setSheetSyncCity(cities[0]);
    }
  }, [cities, sheetSyncCity]);

  const handleSheetSyncSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const city = sheetSyncCity || cities[0] || "";
    const spreadsheetId = extractSpreadsheetId(sheetUrlInput);
    const gid = extractSheetGid(sheetUrlInput);

    if (!city || !spreadsheetId) {
      setSheetSyncMessage(t('sheets.invalidUrl'));
      return;
    }

    const nextConfig = {
      city,
      spreadsheetId,
      gid,
      url: sheetUrlInput.trim(),
    };

    localStorage.setItem(SHEET_SYNC_STORAGE_KEY, JSON.stringify(nextConfig));
    setActiveSheetSync(nextConfig);
    setSheetSyncMessage(t('sheets.syncStarted'));
  };

  const sortedCohorts = useMemo(() => {
    let filtered = [...cohorts];
    if (filterCity) {
      filtered = filtered.filter(c => normalizeCityName(c.ville) === filterCity);
    }
    return filtered.sort((a, b) => {
      const cityA = normalizeCityName(a.ville);
      const cityB = normalizeCityName(b.ville);
      const cityCompare = cityA.localeCompare(cityB);
      if (cityCompare !== 0) return cityCompare;
      
      const extractCohortNum = (id: string) => {
        const match = id.match(/^C(\d+)/i);
        return match ? parseInt(match[1], 10) : null;
      };

      const cNumA = extractCohortNum(a.id);
      const cNumB = extractCohortNum(b.id);

      if (cNumA !== null && cNumB !== null && cNumA !== cNumB) {
        return cNumA - cNumB;
      }
      return a.id.localeCompare(b.id);
    });
  }, [cohorts, filterCity]);

  // --- بقية الـ PDF والـ Render د الواجهة ---
  const generatePDFReport = async () => {
    const doc = new jsPDF('landscape');
    const now = new Date();
    const isEn = i18n.language === 'en';
    const exactDateStr = now.toLocaleDateString(isEn ? 'en-US' : 'fr-FR').replace(/\//g, '-');
    const fileName = `Report_Web4Jobs_${exactDateStr}.pdf`;

    doc.setFontSize(18);
    doc.text("Web4Jobs - Pilotage Dashboard Report", 14, 20);

    const tableColumn = [t('table.city'), t('table.cohorts'), t('table.phase'), t('table.progress'), t('table.status')];
    const tableRows = sortedCohorts.map(c => [
      c.ville, c.id, c.phase, `${Math.round(c.avancement * 100)}%`, c.statut
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 30,
    });

    doc.save(fileName);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 font-sans">
      {/* Header Info */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <Logo className="w-12 h-12 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Web4Jobs Dashboard</h1>
            <p className="text-slate-500 text-sm">Suivi opérationnel des cohortes régionales</p>
          </div>
        </div>

        {/* Global Average Sync Box */}
        <div className="flex items-center gap-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
          <div>
            <span className="text-xs text-slate-400 block uppercase font-bold tracking-wider">Taux de Certification Global</span>
            {isCertificationAverageLoading ? (
              <div className="flex items-center gap-2 mt-1">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                <span className="text-sm text-slate-500">Calcul...</span>
              </div>
            ) : certificationAverageError ? (
              <span className="text-sm text-red-500 block mt-1">⚠️ Error Sheets API</span>
            ) : (
              <span className="text-2xl font-extrabold text-indigo-600 block mt-0.5">
                {certificationAverage?.averageRounded || 0}%
              </span>
            )}
          </div>

          <form onSubmit={handleSheetSyncSubmit} className="flex gap-2 items-center">
            <select 
              value={sheetSyncCity} 
              onChange={(e) => setSheetSyncCity(e.target.value)}
              className="text-xs p-2 rounded-lg bg-white border border-slate-200 outline-none"
            >
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input 
              type="text" 
              placeholder="Lien Google Sheets" 
              value={sheetUrlInput}
              onChange={(e) => setSheetUrlInput(e.target.value)}
              className="text-xs p-2 rounded-lg bg-white border border-slate-200 outline-none w-40"
            />
            <button 
              type="submit" 
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs px-3 py-2 rounded-lg transition"
            >
              Synchroniser
            </button>
          </form>
        </div>
      </header>

      {/* Sheet Sync Feedback Message */}
      {sheetSyncMessage && (
        <div className="mb-4 text-xs text-indigo-600 bg-indigo-50 p-2 rounded-lg inline-block border border-indigo-100">
          ℹ️ {sheetSyncMessage}
        </div>
      )}

      {/* Navigation & Controls */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex bg-white p-1 rounded-xl border border-slate-200/60 shadow-sm gap-1">
          <button 
            onClick={() => setActiveTab('project')} 
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${activeTab === 'project' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Vue d'ensemble
          </button>
          <button 
            onClick={() => generatePDFReport()} 
            className="flex items-center gap-1 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-lg"
          >
            <Download className="w-4 h-4" /> PDF
          </button>
        </div>

        <select 
          value={filterCity} 
          onChange={(e) => setFilterCity(e.target.value)}
          className="text-sm p-2 rounded-xl bg-white border border-slate-200 shadow-sm outline-none"
        >
          <option value="">Toutes les villes</option>
          {cities.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Cohorts Grid & Data View */}
      <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedCohorts.map((cohort) => {
          const styles = getPhaseStyles(cohort.phase);
          return (
            <motion.div 
              layout 
              key={cohort.id} 
              className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${styles.badge}`}>
                    {cohort.ville}
                  </span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${cohort.statut === 'Terminé' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    {cohort.statut}
                  </span>
                </div>
                <h3 className="font-bold text-slate-800 text-lg mb-1">{cohort.id}</h3>
                <p className="text-slate-400 text-xs mb-4">{cohort.phase}</p>
                
                {/* Progress Bar */}
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mb-2">
                  <div className={`h-full ${styles.bar} transition-all duration-500`} style={{ width: `${cohort.avancement * 100}%` }}></div>
                </div>
                <div className="flex justify-between text-xs font-bold text-slate-600 mb-4">
                  <span>Avancement</span>
                  <span>{Math.round(cohort.avancement * 100)}%</span>
                </div>
              </div>
              <div className="text-xs bg-slate-50 p-3 rounded-xl border border-slate-100 text-slate-500 italic">
                {cohort.actions}
              </div>
            </motion.div>
          );
        })}
      </main>
    </div>
  );
}