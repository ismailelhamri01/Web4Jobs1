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
    "P4 - Concepts de Base du No/Low Code",
    "P4 - Formation UI/UX Design",
    "P4 - IT Low/No Code - Partie 1 : Développement Web",
    "P4 - Module Gestion de données",
    "P4 - Création d'une application mobile sans Code",
    "P4 - Module Automation"
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

const CERTIFICATION_COURS: Record<string, string[]> = {
  "P1 - Responsive Web Design Certification": [
    "Learn HTML by Building a Cat Photo App",
    "Learn Basic CSS by Building a Cafe Menu",
    "Learn CSS Colors by Building a Set of Colored Markers",
    "Learn HTML Forms by Building a Registration Form",
    "Survey Form (Certification Project)",
    "Learn the CSS Box Model by Building a Rothko Painting",
    "Learn CSS Flexbox by Building a Photo Gallery",
    "Learn Typography by Building a Nutrition Label",
    "Learn Accessibility by Building a Quiz",
    "Tribute Page (Certification Project)",
    "Learn More About CSS Pseudo Selectors by Building A Balance Sheet",
    "Learn Intermediate CSS by Building a Cat Painting",
    "Learn Responsive Web Design by Building a Piano",
    "Technical Documentation Page (Certification Project)",
    "Learn CSS Variables by Building a City Skyline",
    "Learn CSS Grid by Building a Magazine",
    "Product Landing Page (Certification Project)",
    "Learn CSS Animation by Building a Ferris Wheel",
    "Learn CSS Transforms by Building a Penguin",
    "Personal Portfolio Webpage (Certification Project)"
  ],
  "P1 - Front End Development Libraries Certification": [
    "Bootstrap",
    "jQuery",
    "SASS",
    "React",
    "Redux",
    "React and Redux",
    "Front End Development Libraries Projects"
  ],
  "P1 - Back End Development and APIs Certification": [
    "Managing Packages with NPM",
    "Basic Node and Express",
    "MongoDB and Mongoose",
    "Back End Development and APIs Projects"
  ],
  "P2 - Data Visualization Certification": [
    "JSON APIs and AJAX",
    "Data Visualization Projects"
  ],
  "P2 - Relational Database Certification": [
    "Learn Bash by Building a Boilerplate",
    "Learn Relational Databases by Building a Mario Database",
    "Celestial Bodies Database"
  ],
  "P2 - Data Analysis with Python Certification": [
    "Data Analysis with Python",
    "NumPy",
    "Pandas",
    "Matplotlib",
    "Data Analysis with Python Projects"
  ],
  "P3 - Network Security Certification": [
    "Introduction to Network",
    "Introduction to Network Security",
    "Compliance and Audit in Network Security",
    "Network traffic analysis with RedHand Online PCAP Analyzer"
  ],
  "P3 - Web security Certification": [
    "Intro HTTP Webapp Security",
    "Build a Basic HTML and CSS Web App",
    "Web Application Security Scanner with Python"
  ],
  "P3 - Information Security Certification": [
    "Information Security with HelmetJS",
    "Python for Penetration Testing",
    "Information Security Projects"
  ]
};

const PHASE_3_PARCOURS: Record<string, string[]> = {
  "Web Developer & Solution": [
    "P1 - Responsive Web Design Certification",
    "P1 - Front End Development Libraries Certification",
    "P1 - Back End Development and APIs Certification",
    "P1 - Projet final"
  ],
  "Data Developer Certification": [
    "P2 - Data Visualization Certification",
    "P2 - Relational Database Certification",
    "P2 - Data Analysis with Python Certification",
    "P2 - Projet final"
  ],
  "Security Developer Certification": [
    "P3 - Information Security Certification",
    "P3 - Web security Certification",
    "P3 - Network Security Certification",
    "P3 - Projet final"
  ],
  "Formation No/Low code": [
    "P4 - Concepts de Base du No/Low Code",
    "P4 - Formation UI/UX Design",
    "P4 - IT Low/No Code - Partie 1 : Développement Web",
    "P4 - Module Gestion de données",
    "P4 - Création d'une application mobile sans Code",
    "P4 - Module Automation"
  ]
};

const formatDisplayLabel = (label: string) => {
  if (!label) return "";
  return label.replace(/^parcours\./, "").trim();
};

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
      // Use selected parcours or default to first one for consistent denominator
      const pk = parcours || "Web Developer & Solution";
      relevantSteps.push(...PHASE_3_PARCOURS[pk]);
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

// --- Helpers ---
const formatDate = (str: string) => {
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

// --- Helpers ---
const normalizeCityName = (name: string): string => {
  if (!name) return "INCONNU";
  let trimmed = name.trim();
  if (!trimmed || trimmed.toUpperCase() === "INCONNU" || trimmed.toUpperCase() === "UNKNOWN") return "INCONNU";
  
  // Specific mappings for incomplete names
  const upper = trimmed.toUpperCase();
  if (upper === "AÏN" || upper === "AIN") trimmed = "Aïn Aouda";
  if (upper === "SIDI") trimmed = "Sidi Kacem";
  
  // Capitalize words separated by spaces, dashes, or slashes for display consistency
  // Robust approach for accented characters
  return trimmed.split(/([\s-/])/).map(part => {
    if (part.length === 0 || /[\s-/]/.test(part)) return part;
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  }).join('');
};

const extractCityFromId = (id: string): string => {
  if (!id) return "INCONNU";
  // Split by dash with optional spaces
  const parts = id.split(/\s*-\s*/);
  if (parts.length < 2) {
    // Fallback: if no dash, check if the ID itself contains a known city or just return it normalized if it looks like a city
    const trimmedId = id.trim();
    if (trimmedId.length > 0 && !trimmedId.startsWith('C')) {
      return normalizeCityName(trimmedId);
    }
    return "INCONNU";
  }
  
  let cityPart = parts[1].trim();
  // Remove "Promo X" at the end (case insensitive)
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

const StatusIcon = ({ status }: { status: string }) => {
  if (status === 'Terminé' || status === 'Clôture') return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
  if (status === 'Fin de phase') return <AlertCircle className="w-4 h-4 text-amber-500" />;
  if (status === 'Démarrage' || status === 'Non démarré') return <Clock className="w-4 h-4 text-slate-400" />;
  if (status === 'Décalé') return <AlertCircle className="w-4 h-4 text-orange-500" />;
  return <div className="w-2 h-2 rounded-full bg-blue-500" />;
};

export default function App() {
  const { t, i18n } = useTranslation();
  const [cohorts, setCohorts] = useState<Cohort[]>(() => {
    const saved = localStorage.getItem('web4jobs_cohorts');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migration: Ensure all cohorts have a valid 'ville' property
      return parsed.map((c: any) => {
        let currentVille = c.ville;
        if (!currentVille || currentVille.toUpperCase() === "INCONNU" || currentVille.toUpperCase() === "UNKNOWN") {
          currentVille = extractCityFromId(c.id);
        } else {
          currentVille = normalizeCityName(currentVille);
        }
        return {
          ...c,
          ville: currentVille
        };
      });
    }
    return COHORTS.map(c => ({ ...c, ville: normalizeCityName(c.ville) }));
  });

  useEffect(() => {
    localStorage.setItem('web4jobs_cohorts', JSON.stringify(cohorts));
  }, [cohorts]);

  const [activeTab, setActiveTab] = useState<Tab>('project');
  const [selectedCohort, setSelectedCohort] = useState<Cohort | null>(null);
  const [editingCohort, setEditingCohort] = useState<Cohort | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [aiResult, setAiResult] = useState<string>("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  const [modalPhase, setModalPhase] = useState("");
  const [modalParcours, setModalParcours] = useState("");
  const [modalEtape, setModalEtape] = useState("");
  const [modalSousEtape, setModalSousEtape] = useState("");
  const [modalVille, setModalVille] = useState("");

  const urlParams = new URLSearchParams(window.location.search);
  const langParam = urlParams.get('lang') || 'fr';
  const [currentLang, setCurrentLang] = useState(langParam);
  const [isLangOpen, setIsLangOpen] = useState(false);

  const [isContactOpen, setIsContactOpen] = useState(false);
  const [isContactSending, setIsContactSending] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactForm, setContactForm] = useState({ email: '', message: '' });
  const [certificationAverage, setCertificationAverage] = useState<CertificationAverage | null>(null);
  const [isCertificationAverageLoading, setIsCertificationAverageLoading] = useState(true);
  const [certificationAverageError, setCertificationAverageError] = useState<string | null>(null);
  const [sheetUrlInput, setSheetUrlInput] = useState(() => {
    try {
      const saved = localStorage.getItem(SHEET_SYNC_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as SheetSyncConfig).url || "" : "";
    } catch {
      return "";
    }
  });
  const [sheetSyncCity, setSheetSyncCity] = useState(() => {
    try {
      const saved = localStorage.getItem(SHEET_SYNC_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as SheetSyncConfig).city || "" : "";
    } catch {
      return "";
    }
  });
  const [activeSheetSync, setActiveSheetSync] = useState<SheetSyncConfig | null>(() => {
    try {
      const saved = localStorage.getItem(SHEET_SYNC_STORAGE_KEY);
      return saved ? JSON.parse(saved) as SheetSyncConfig : null;
    } catch {
      return null;
    }
  });
  const [sheetSyncMessage, setSheetSyncMessage] = useState<string | null>(null);

  const [collapsedCities, setCollapsedCities] = useState<Set<string>>(new Set());
  const [filterCity, setFilterCity] = useState("");
  const [cohortToDelete, setCohortToDelete] = useState<Cohort | null>(null);
  const [cityToDelete, setCityToDelete] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
        const params = new URLSearchParams();

        if (activeSheetSync) {
          params.set('spreadsheetId', activeSheetSync.spreadsheetId);
          params.set('city', activeSheetSync.city);
          if (activeSheetSync.gid) {
            params.set('gid', activeSheetSync.gid);
          }
        }

        const query = params.toString();
        const response = await fetch(`/api/sheets/city-progress${query ? `?${query}` : ''}`, { cache: 'no-store' });
        const data = await response.json() as { cities?: CityProgress[]; code?: string };

        if (!response.ok) {
          throw new Error(data?.code ? t(`sheets.${data.code}`) : t('sheets.error'));
        }

        const cityProgress = data.cities || [];
        const totalCount = cityProgress.reduce((sum, city) => sum + city.count, 0);
        const weightedAverage = totalCount
          ? cityProgress.reduce((sum, city) => sum + city.average * city.count, 0) / totalCount
          : 0;

        if (isMounted) {
          setCertificationAverage({
            average: weightedAverage,
            averageRounded: Math.round(weightedAverage),
            count: totalCount,
          });
          setSheetSyncMessage(
            activeSheetSync && cityProgress[0]
              ? `${activeSheetSync.city} : ${cityProgress[0].averageRounded}%`
              : null
          );

          setCohorts((previousCohorts) => {
            let hasChanges = false;
            const progressByCity = new Map(
              cityProgress.map((city) => [
                normalizeCityName(city.city),
                Math.max(0, Math.min(1, city.progress)),
              ])
            );

            const nextCohorts = previousCohorts.map((cohort) => {
              const progress = progressByCity.get(normalizeCityName(cohort.ville));

              if (progress === undefined) return cohort;

              const roundedProgress = Math.round(progress * 100) / 100;
              const status = getStatusFromProgress(roundedProgress) as Cohort['statut'];

              if (cohort.avancement === roundedProgress && cohort.statut === status) {
                return cohort;
              }

              hasChanges = true;

              return {
                ...cohort,
                avancement: roundedProgress,
                statut: status,
              };
            });

            return hasChanges ? nextCohorts : previousCohorts;
          });
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
    intervalId = setInterval(loadCityProgress, 10000);

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [activeSheetSync, t]);

  const toggleCity = (city: string) => {
    setCollapsedCities(prev => {
      const newSet = new Set(prev);
      if (newSet.has(city)) newSet.delete(city);
      else newSet.add(city);
      return newSet;
    });
  };

  const toggleAllCities = () => {
    if (collapsedCities.size > 0) {
      // If any are collapsed, expand all
      setCollapsedCities(new Set());
    } else {
      // If none are collapsed, collapse all
      setCollapsedCities(new Set(cities));
    }
  };

  const handleDeleteCohort = (cohort: Cohort) => {
    setCohorts(prev => prev.filter(c => c.id !== cohort.id));
    setCohortToDelete(null);
  };

  const handleDeleteCity = (city: string) => {
    const relatedCohorts = cohorts.filter(c => normalizeCityName(c.ville) === city);
    if (relatedCohorts.length > 0) {
      setDeleteError(t('error.cityHasCohorts', { count: relatedCohorts.length }));
      return;
    }
    // If it was a predefined city or something, we'd remove it from a list.
    // Since it's derived, it will just disappear if we delete its cohorts.
    // But the user asked for this logic, so we implement the check.
    setCityToDelete(null);
  };

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
      // Sort by city first (normalized for comparison)
      const cityA = normalizeCityName(a.ville);
      const cityB = normalizeCityName(b.ville);
      const cityCompare = cityA.localeCompare(cityB);
      if (cityCompare !== 0) return cityCompare;
      
      // Extract cohort number (C1, C2, etc.) from the start of the ID
      const extractCohortNum = (id: string) => {
        const match = id.match(/^C(\d+)/i);
        return match ? parseInt(match[1], 10) : null;
      };

      // Extract promo number from the ID
      const extractPromoNum = (id: string) => {
        const match = id.match(/Promo\s*(\d+)/i);
        return match ? parseInt(match[1], 10) : null;
      };

      const cNumA = extractCohortNum(a.id);
      const cNumB = extractCohortNum(b.id);

      // If both have C numbers, they are the primary indicator of order (C1 < C6)
      if (cNumA !== null && cNumB !== null && cNumA !== cNumB) {
        return cNumA - cNumB;
      }

      // Then by start date (chronological)
      const dateA = a.debut ? new Date(a.debut).getTime() : 0;
      const dateB = b.debut ? new Date(b.debut).getTime() : 0;
      
      if (dateA !== dateB && dateA !== 0 && dateB !== 0) {
        return dateA - dateB;
      }
      
      // Fallback to Promo number
      const promoA = extractPromoNum(a.id);
      const promoB = extractPromoNum(b.id);
      
      if (promoA !== null && promoB !== null && promoA !== promoB) {
        return promoA - promoB;
      }
      
      // Final fallback by ID
      return a.id.localeCompare(b.id);
    });
  }, [cohorts, filterCity]);

  const groupedCohorts = useMemo(() => {
    const groups: Record<string, Cohort[]> = {};
    sortedCohorts.forEach(c => {
      const city = normalizeCityName(c.ville);
      if (!groups[city]) groups[city] = [];
      groups[city].push(c);
    });
    return groups;
  }, [sortedCohorts]);

  const languages = [
    { code: 'fr', label: 'Français', flagUrl: 'https://flagcdn.com/w40/fr.png' },
    { code: 'en', label: 'English', flagUrl: 'https://flagcdn.com/w40/gb.png' }
  ];

  const handleLangChange = (code: string) => {
    setCurrentLang(code);
    setIsLangOpen(false);
    i18n.changeLanguage(code);
    
    // Update URL without reloading
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('lang', code);
    window.history.pushState({}, '', newUrl);
  };

  const generatePDFReport = async () => {
    const doc = new jsPDF('landscape');
    
    const now = new Date();
    const isEn = i18n.language === 'en';
    
    const monthNamesFr = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
      "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
    ];
    const monthNamesEn = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    
    const currentMonth = isEn ? monthNamesEn[now.getMonth()] : monthNamesFr[now.getMonth()];
    const currentYear = now.getFullYear();

    const exactDateStr = now.toLocaleDateString(isEn ? 'en-US' : 'fr-FR').replace(/\//g, '-');
    const exactTimeStr = now.toLocaleTimeString(isEn ? 'en-US' : 'fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
    const fileName = `${t('report.filename')}_${exactDateStr}_${exactTimeStr}.pdf`;

    const drawPdfContent = (logoBase64: string | null) => {
      try {
        if (logoBase64) {
          // We use try-catch here because jsPDF might throw if the base64 is not a valid image
          doc.addImage(logoBase64, 'PNG', 14, 10, 20, 20);
        }
      } catch (e) {
        console.warn("Impossible d'ajouter le logo au PDF", e);
      }
      
      const pageSize = doc.internal.pageSize;
      const pageWidth = pageSize.width ? pageSize.width : pageSize.getWidth();

      // Add Title centered
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(59, 44, 107); // #3b2c6b
      doc.text(`${t('report.monthTitle')} ${currentMonth} ${currentYear}`, pageWidth / 2, 24, { align: 'center' });
      doc.setFont("helvetica", "normal"); // reset font style
      
      // Add Table
      const tableColumn = [
        t('table.city'),
        t('table.cohorts'), 
        t('table.phase'), 
        t('table.step'), 
        t('table.startDate'), 
        t('table.endDate'), 
        t('table.progress'), 
        t('table.status'),
        t('table.actions')
      ];
      const tableRows: any[] = [];
      
      sortedCohorts.forEach(c => {
        const rowData = [
          c.ville,
          c.id,
          t(`phases.${getPhaseTranslationKey(c.phase)}`),
          t(`steps.${c.etape}`),
          formatDate(c.debut),
          formatDate(c.fin),
          `${Math.round(c.avancement * 100)}%`,
          t(`status.${getStatusKey(getStatusFromProgress(c.avancement))}`),
          c.actions
        ];
        tableRows.push(rowData);
      });
      
      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 40,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 3, textColor: [50, 50, 50] },
        headStyles: { fillColor: [59, 44, 107], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] }, // slate-50
        didDrawPage: (data) => {
          // Footer
          doc.setFontSize(8);
          doc.setTextColor(128, 128, 128);
          const pageSize = doc.internal.pageSize;
          const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
          const pageWidth = pageSize.width ? pageSize.width : pageSize.getWidth();
          
          const footerExactDate = now.toLocaleDateString(isEn ? 'en-US' : 'fr-FR');
          const footerExactTime = now.toLocaleTimeString(isEn ? 'en-US' : 'fr-FR', { hour: '2-digit', minute: '2-digit' });
          const footerText = `${t('report.savedOn')} ${footerExactDate} ${t('report.at')} ${footerExactTime}`;
          
          const textWidth = doc.getStringUnitWidth(footerText) * doc.getFontSize() / doc.internal.scaleFactor;
          doc.text(footerText, pageWidth - textWidth - 14, pageHeight - 10);
        }
      });
      
      doc.save(fileName);
    };

    try {
      // Try to load the specific PDF logo first, including the one the user uploaded, then fallback
      const urlsToTry = ['/logo-pdf/logo.png', '/logo-pdf/logo pdf.png', '/logo/logo w4j.png'];
      let validBlob = null;

      for (const url of urlsToTry) {
        try {
          const response = await fetch(url);
          if (response.ok) {
            const blob = await response.blob();
            // Vite returns text/html for 404s in SPA mode, so we MUST check the MIME type
            if (blob.type.startsWith('image/')) {
              validBlob = blob;
              break;
            }
          }
        } catch (e) {
          // Ignore fetch errors and try the next URL
        }
      }
      
      if (validBlob) {
        const reader = new FileReader();
        reader.readAsDataURL(validBlob);
        reader.onloadend = () => {
          drawPdfContent(reader.result as string);
        };
      } else {
        drawPdfContent(null);
      }
    } catch (error) {
      console.error("Error loading logo for PDF", error);
      drawPdfContent(null);
    }
  };

  useEffect(() => {
    if (editingCohort) {
      let p = editingCohort.phase;
      // Map old names to new ones for compatibility
      const newPhases = Object.keys(PHASE_STEPS);
      const matched = newPhases.find(np => np.startsWith(p + " :") || np === p || np.endsWith(p));
      if (matched) p = matched;

      setModalPhase(p);
      setModalEtape(editingCohort.etape);
      setModalSousEtape(editingCohort.sousEtape || "");
      setModalVille(editingCohort.ville || "");

      // Set modalParcours
      if (editingCohort.parcours) {
        setModalParcours(editingCohort.parcours);
      } else if (p === "Phase 3 : Certification") {
        const parcours = Object.keys(PHASE_3_PARCOURS).find(pk => 
          PHASE_3_PARCOURS[pk].includes(editingCohort.etape)
        );
        if (parcours) setModalParcours(parcours);
      } else {
        setModalParcours("");
      }
    } else if (isAdding) {
      setModalPhase("");
      setModalParcours("");
      setModalEtape("");
      setModalSousEtape("");
      setModalVille("");
    }
  }, [editingCohort, isAdding]);

  const handlePhaseChange = (p: string) => {
    setModalPhase(p);
    setModalParcours("");
    setModalSousEtape("");
    if (p && !PHASE_STEPS[p]?.includes(modalEtape)) {
      setModalEtape("");
    }
  };

  const handleParcoursChange = (pk: string) => {
    setModalParcours(pk);
    setModalEtape("");
    setModalSousEtape("");
  };

  const handleEtapeChange = (e: string) => {
    setModalEtape(e);
    setModalSousEtape("");
    if (e) {
      let p = Object.keys(PHASE_STEPS).find(key => PHASE_STEPS[key].includes(e));
      if (!p) {
        // Check Phase 3 parcours
        const inParcours = Object.keys(PHASE_3_PARCOURS).some(pk => PHASE_3_PARCOURS[pk].includes(e));
        if (inParcours) p = "Phase 3 : Certification";
      }

      if (p) {
        setModalPhase(p);
        if (p === "Phase 3 : Certification") {
          const pk = Object.keys(PHASE_3_PARCOURS).find(key => PHASE_3_PARCOURS[key].includes(e));
          if (pk) setModalParcours(pk);
        }
      }
    }
  };

  const askAI = async (cohort: Cohort) => {
    setSelectedCohort(cohort);
    setIsAiLoading(true);
    setAiResult("");

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const prompt = `Agis en tant qu'expert en gestion de projet éducatif (Web4Jobs). Analyse cette cohorte et propose 3 recommandations stratégiques brèves pour assurer le respect des délais.
    Contexte Phase 3 (Spécialisation) :
    - Parcours 1 (Web): Responsive Web Design, Front End Libraries, Back End & APIs, Projet final.
    - Parcours 2 (Data): Data Visualization, Relational Database, Data Analysis (Python), Projet final.
    - Parcours 3 (Security): Information Security, Web Security, Network Security, Projet final.
    - Parcours 4 (No/Low code): Fondamentaux, automatisation, applications, projet final.
    Contexte Phase 4 (Insertion) :
    - Étape 1 : Orientation (1 sem) - webinaires, études de cas, mises en situation.
    - Étape 2 : Accompagnement (2-3 sem) - formations complémentaires, ateliers pratiques.
    - Étape 3 : Mise en pratique (Dominante) - CV/entretiens, Auto-entrepreneur, Structuration projet, ou Coopérative (juridique/financement).
    Données : Nom=${cohort.id}, Phase=${cohort.phase}, Avancement=${Math.round(cohort.avancement * 100)}%, Statut=${cohort.statut}, Actions actuelles=${cohort.actions}. 
    Format: Liste courte avec émojis. Réponds en ${i18n.language === 'en' ? 'anglais' : 'français'}.`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      setAiResult(response.text || t('ai.noRecommendation'));
    } catch (err) {
      console.error(err);
      setAiResult(t('ai.error'));
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.email || !contactForm.message) return;

    setIsContactSending(true);
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm),
      });

      if (response.ok) {
        setContactSuccess(true);
        setContactForm({ email: '', message: '' });
        setTimeout(() => {
          setContactSuccess(false);
          setIsContactOpen(false);
        }, 3000);
      }
    } catch (err) {
      console.error('Error sending contact form:', err);
    } finally {
      setIsContactSending(false);
    }
  };

  const renderProgressStatus = (progress: number, variant: 'inline' | 'badge' = 'inline') => {
    const status = getStatusFromProgress(progress);
    const isCompleted = status === 'Terminé';
    const label = t(`status.${getStatusKey(status)}`);

    if (variant === 'badge') {
      return (
        <span className={`inline-flex items-center gap-2 px-2 py-1 rounded text-[0.625rem] font-bold uppercase ${
          isCompleted ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
        }`}>
          <span className={`w-2 h-2 rounded-full ${isCompleted ? 'bg-emerald-500' : 'bg-blue-500'}`} />
          {label}
        </span>
      );
    }

    return (
      <div className={`flex items-center gap-2 font-medium ${isCompleted ? 'text-emerald-700' : 'text-blue-700'}`}>
        <StatusIcon status={status} />
        <span>{label}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 text-slate-800 font-sans flex flex-col">
      <div className="flex-grow p-2 md:p-4">
        <div className="max-w-[98%] mx-auto">
        {/* Header */}
        <header className="mb-10">
          {/* Ligne 1: Logo à gauche + Boutons à droite */}
          <div className="flex flex-row justify-between items-center pb-4 mb-8 gap-4">
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-center justify-center w-14 h-14 sm:w-16 sm:h-16 shrink-0">
                <Logo className="w-full h-full drop-shadow-sm" />
              </div>
              <span className="text-3xl sm:text-4xl font-light tracking-widest text-[#3b2c6b]" style={{ fontFamily: 'sans-serif' }}>
                WEB<span className="text-[#a0a0a0] font-medium">4</span>JOBS
              </span>
            </div>

            <div className="flex gap-2 sm:gap-4 relative items-center">
              <div className="relative">
                <button 
                  onClick={generatePDFReport}
                  className="flex items-center gap-2 bg-emerald-600 border border-emerald-600 hover:bg-emerald-700 text-white px-3 sm:px-4 py-2 rounded-full shadow-sm transition-all font-medium active:scale-95 text-sm sm:text-base"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('header.report')}</span>
                </button>
              </div>
              <div className="relative">
                <button 
                  onClick={() => setIsLangOpen(!isLangOpen)}
                  className="flex items-center gap-2 bg-[#f3eef6] border border-[#d1c4e9] hover:bg-[#e8e0ef] text-[#5e35b1] px-3 sm:px-4 py-2 rounded-full shadow-sm transition-all font-bold active:scale-95 text-sm sm:text-base"
                >
                  <span className="hidden sm:inline">{languages.find(l => l.code === currentLang)?.label}</span>
                  <img 
                    src={languages.find(l => l.code === currentLang)?.flagUrl} 
                    alt="flag" 
                    className="w-5 h-3.5 object-cover rounded-[2px]" 
                  />
                  <ChevronDown className={`w-4 h-4 transition-transform ${isLangOpen ? 'rotate-180' : ''}`} />
                </button>
                
                <AnimatePresence>
                  {isLangOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 p-2"
                    >
                      {languages.map((lang) => (
                        <button
                          key={lang.code}
                          onClick={() => handleLangChange(lang.code)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 mb-1 last:mb-0 text-sm transition-colors rounded-xl font-bold ${
                            currentLang === lang.code 
                              ? 'bg-[#f3eef6] border border-[#d1c4e9] text-[#111]' 
                              : 'text-[#111] hover:bg-gray-50 border border-transparent'
                          }`}
                        >
                          <img 
                            src={lang.flagUrl} 
                            alt={lang.label} 
                            className="w-5 h-3.5 object-cover rounded-[2px]" 
                          />
                          <span>{lang.label}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button 
                onClick={() => window.location.href = 'https://w4j.yool.education/'}
                className="flex items-center gap-2 bg-gradient-to-r from-[#5e35b1] to-[#8b5cf6] hover:from-[#4c2b92] hover:to-[#7c3aed] text-white px-4 sm:px-6 py-2 sm:py-2.5 rounded-full shadow-md transition-all font-medium active:scale-95 text-sm sm:text-base"
              >
                <LogIn className="w-5 h-5" />
                <span className="hidden sm:inline">{t('header.login')}</span>
                <LogIn className="w-5 h-5 sm:hidden" />
              </button>
            </div>
          </div>

          {/* Ligne 2: Titre centré */}
          <div className="text-center mt-8 sm:mt-12">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#3b2c6b] tracking-tight">
              {t('header.title')}
            </h1>
          </div>
        </header>

        <section className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5 md:col-span-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[0.625rem] font-bold text-slate-400 uppercase tracking-widest">
                  {t('sheets.certification1Average')}
                </p>
                <div className="mt-2 flex items-baseline gap-2">
                  {isCertificationAverageLoading ? (
                    <div className="flex items-center gap-2 text-[#3b2c6b]">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm font-bold">{t('sheets.loading')}</span>
                    </div>
                  ) : certificationAverage ? (
                    <>
                      <span className="text-4xl font-bold text-[#3b2c6b]">
                        {certificationAverage.averageRounded}%
                      </span>
                      <span className="text-xs font-bold text-slate-400 uppercase">
                        {t('sheets.fromRows', { count: certificationAverage.count })}
                      </span>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-amber-700">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <span className="text-sm font-bold">{t('sheets.unavailable')}</span>
                    </div>
                  )}
                </div>
                {certificationAverageError && (
                  <p className="mt-2 text-xs text-slate-500">{certificationAverageError}</p>
                )}
              </div>
              <div className="w-10 h-10 rounded-lg bg-[#3b2c6b]/10 text-[#3b2c6b] flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
          </div>
          <form
            onSubmit={handleSheetSyncSubmit}
            className="bg-white border border-gray-100 rounded-xl shadow-sm p-5 md:col-span-2"
          >
            <p className="text-[0.625rem] font-bold text-slate-400 uppercase tracking-widest">
              {t('sheets.syncTitle')}
            </p>
            <div className="mt-3 grid grid-cols-1 lg:grid-cols-[12rem_1fr_auto] gap-3">
              <select
                value={sheetSyncCity}
                onChange={(event) => setSheetSyncCity(event.target.value)}
                className="h-11 rounded border border-gray-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-[#3b2c6b] focus:ring-2 focus:ring-[#3b2c6b]/10"
              >
                {cities.map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
              <input
                value={sheetUrlInput}
                onChange={(event) => setSheetUrlInput(event.target.value)}
                placeholder={t('sheets.urlPlaceholder')}
                className="h-11 rounded border border-gray-200 px-3 text-sm text-slate-700 outline-none focus:border-[#3b2c6b] focus:ring-2 focus:ring-[#3b2c6b]/10"
              />
              <button
                type="submit"
                className="h-11 inline-flex items-center justify-center gap-2 rounded bg-[#3b2c6b] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#2f2357] active:scale-95"
              >
                <Send className="w-4 h-4" />
                {t('sheets.syncButton')}
              </button>
            </div>
            {sheetSyncMessage && (
              <p className="mt-2 text-xs font-medium text-slate-500">{sheetSyncMessage}</p>
            )}
          </form>
        </section>

        {/* Tab Navigation */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-gray-200">
          <nav className="flex gap-4">
            <button 
              onClick={() => setActiveTab('project')}
              className={`flex items-center gap-3 px-6 py-3 font-bold text-base transition-all border-b-4 rounded-t-xl ${
                activeTab === 'project' 
                  ? "border-[#3b2c6b] text-[#3b2c6b] bg-[#3b2c6b]/5" 
                  : "border-transparent text-slate-500 hover:text-[#3b2c6b] hover:bg-gray-100/50"
              }`}
            >
              <LayoutList className="w-5 h-5" />
              {t('tabs.project')}
            </button>
            <button 
              onClick={() => setActiveTab('table')}
              className={`flex items-center gap-3 px-6 py-3 font-bold text-base transition-all border-b-4 rounded-t-xl ${
                activeTab === 'table' 
                  ? "border-[#3b2c6b] text-[#3b2c6b] bg-[#3b2c6b]/5" 
                  : "border-transparent text-slate-500 hover:text-[#3b2c6b] hover:bg-gray-100/50"
              }`}
            >
              <LayoutList className="w-5 h-5" />
              {t('tabs.table')}
            </button>
            <button 
              onClick={() => setActiveTab('gantt')}
              className={`flex items-center gap-3 px-6 py-3 font-bold text-base transition-all border-b-4 rounded-t-xl ${
                activeTab === 'gantt' 
                  ? "border-[#3b2c6b] text-[#3b2c6b] bg-[#3b2c6b]/5" 
                  : "border-transparent text-slate-500 hover:text-[#3b2c6b] hover:bg-gray-100/50"
              }`}
            >
              <CalendarDays className="w-5 h-5" />
              {t('tabs.gantt')}
            </button>
            <button 
              onClick={() => setActiveTab('manage')}
              className={`flex items-center gap-3 px-6 py-3 font-bold text-base transition-all border-b-4 rounded-t-xl ${
                activeTab === 'manage' 
                  ? "border-[#3b2c6b] text-[#3b2c6b] bg-[#3b2c6b]/5" 
                  : "border-transparent text-slate-500 hover:text-[#3b2c6b] hover:bg-gray-100/50"
              }`}
            >
              <Pencil className="w-5 h-5" />
              {t('tabs.data')}
            </button>
          </nav>

          <div className="flex items-center gap-4 px-4 pb-2 md:pb-0">
            <button
              onClick={toggleAllCities}
              className="flex items-center gap-2 text-xs font-bold text-[#3b2c6b] hover:bg-[#3b2c6b]/5 px-3 py-1.5 rounded-lg border border-[#3b2c6b]/20 transition-all active:scale-95 whitespace-nowrap"
            >
              <ChevronsUpDown className="w-3.5 h-3.5" />
              {collapsedCities.size > 0 ? t('table.expandAll') : t('table.collapseAll')}
            </button>

            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase whitespace-nowrap">{t('table.city')}:</label>
              <select 
                value={filterCity}
                onChange={(e) => setFilterCity(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-[#3b2c6b] outline-none bg-white text-sm font-medium text-slate-700 min-w-[120px]"
              >
                <option value="">{i18n.language === 'en' ? 'All Cities' : 'Toutes les villes'}</option>
                {cities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <AnimatePresence mode="wait">
            {activeTab === 'project' ? (
              <motion.div 
                key="project"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-[37.5rem] overflow-auto relative"
              >
                <div className="flex min-w-max">
                  {/* Left Side: Task List */}
                  <div className="w-[30rem] sticky left-0 border-r border-gray-200 bg-white z-40 shadow-xl">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead className="sticky top-0 bg-slate-50 z-50 shadow-sm">
                        <tr className="text-[#3b2c6b] text-base font-bold border-b border-gray-200">
                          <th className="p-4 border-r border-gray-200 w-16">{t('table.id')}</th>
                          <th className="p-4 border-r border-gray-200 w-32">{t('table.city')}</th>
                          <th className="p-4 border-r border-gray-200">{t('table.taskName')}</th>
                          <th className="p-4 w-24">{t('table.duration')}</th>
                        </tr>
                      </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(Object.entries(groupedCohorts) as [string, Cohort[]][]).map(([city, cityCohorts]) => (
                        <React.Fragment key={city}>
                          <tr 
                            className="bg-slate-100/90 font-bold text-[#3b2c6b] h-12 cursor-pointer hover:bg-slate-200 transition-colors border-l-4 border-[#3b2c6b]"
                            onClick={() => toggleCity(city)}
                          >
                            <td className="p-4 text-center border-r border-gray-200">
                              {collapsedCities.has(city) ? <ChevronRight className="w-4 h-4 inline" /> : <ChevronDown className="w-4 h-4 inline" />}
                            </td>
                            <td colSpan={3} className="p-4 pl-4 tracking-wide text-sm font-bold">
                              <span className="text-[#3b2c6b]">{city}</span>
                              <span className="ml-2 text-slate-500 font-medium lowercase">
                                ({cityCohorts.length} {cityCohorts.length > 1 ? t('table.cohorts').toLowerCase() : t('table.cohort').toLowerCase()})
                              </span>
                            </td>
                          </tr>
                          {!collapsedCities.has(city) && cityCohorts.map((c) => (
                            <tr key={c.id} className="hover:bg-slate-50 transition-colors h-14">
                              <td className="p-4 text-slate-400 border-r border-gray-200 text-center text-xs">{cohorts.findIndex(co => co.id === c.id) + 1}</td>
                              <td className="p-4 text-slate-600 border-r border-gray-200 font-medium text-xs truncate">{c.ville}</td>
                              <td className="p-4 font-medium text-slate-900 border-r border-gray-200 truncate max-w-[12rem] text-xs">{c.id}</td>
                              <td className="p-4 text-slate-500 text-xs">
                                {Math.ceil((new Date(c.fin).getTime() - new Date(c.debut).getTime()) / (1000 * 60 * 60 * 24))} {i18n.language === 'en' ? 'd' : 'j'}
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>

                  {/* Right Side: Gantt Chart */}
                  <div className="flex-1 bg-slate-50 relative">
                    <div className="min-w-[75rem]">
                      {/* Timeline Header */}
                      <div className="sticky top-0 bg-slate-50 z-30 flex border-b border-gray-200 h-12">
                      {QUARTERS.map(q => (
                        <div key={q} className="flex-1 border-l border-gray-200 text-base font-bold text-[#3b2c6b] flex items-center justify-center uppercase tracking-tighter">
                          {i18n.language === 'en' ? q.replace('T', 'Q') : q}
                        </div>
                      ))}
                    </div>

                    {/* Timeline Grid & Bars */}
                    <div className="relative">
                      {/* Vertical Grid Lines */}
                      <div className="absolute inset-0 flex pointer-events-none">
                        {QUARTERS.map(q => (
                          <div key={q} className="flex-1 border-l border-gray-200/50 h-full"></div>
                        ))}
                      </div>

                      {/* Bars grouped by city */}
                      {(Object.entries(groupedCohorts) as [string, Cohort[]][]).map(([city, cityCohorts]) => (
                        <React.Fragment key={city}>
                          {/* Empty row for city header alignment */}
                          <div className="h-12 border-b border-gray-200/50 bg-slate-100/20"></div>
                          {!collapsedCities.has(city) && cityCohorts.map(c => {
                            const s = new Date(c.debut).getTime();
                            let e = new Date(c.fin).getTime();
                            if (e < s) e = s + (1000 * 60 * 60 * 24 * 7);
                            const left = ((s - TIME_MIN) / TOTAL_DURATION) * 100;
                            const width = ((e - s) / TOTAL_DURATION) * 100;
                            const phaseStyles = getPhaseStyles(c.phase);

                            return (
                              <div key={c.id} className="h-14 flex items-center relative group border-b border-gray-100/50">
                                <motion.div 
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  style={{ left: `${left}%`, width: `${width}%` }}
                                  className={`absolute h-8 rounded-sm shadow-sm border border-black/10 flex items-center px-3 overflow-hidden cursor-pointer hover:brightness-95 transition-all ${phaseStyles.bar}`}
                                  onClick={() => askAI(c)}
                                >
                                  <div 
                                    className="absolute left-0 top-0 h-full bg-black/20" 
                                    style={{ width: `${c.avancement * 100}%` }}
                                  />
                                  <span className="relative z-10 text-[0.75rem] font-bold text-white truncate drop-shadow-sm">
                                    {t(`phases.${getPhaseTranslationKey(c.phase)}`)} : {t(`steps.${c.etape}`)}
                                  </span>
                                </motion.div>
                              </div>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
            ) : activeTab === 'table' ? (
              <motion.div 
                key="table"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="overflow-x-auto"
              >
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[#3b2c6b] font-bold border-b border-gray-200 text-lg">
                      <th className="p-5 w-48">{t('table.city')}</th>
                      <th className="p-5">{t('table.cohortCenter')}</th>
                      <th className="p-5">{t('table.phase')} & {t('table.step')}</th>
                      <th className="p-5">{t('table.period')}</th>
                      <th className="p-5">{t('table.progress')}</th>
                      <th className="p-5">{t('table.status')}</th>
                      <th className="p-5 w-1/4">{t('table.actionsAI')}</th>
                    </tr>
                  </thead>
                  <tbody className="text-base divide-y divide-gray-100">
                    {(Object.entries(groupedCohorts) as [string, Cohort[]][]).map(([city, cityCohorts]) => (
                      <React.Fragment key={city}>
                        <tr 
                          className="bg-slate-100/90 font-bold text-[#3b2c6b] cursor-pointer hover:bg-slate-200/50 transition-colors border-l-4 border-[#3b2c6b]"
                          onClick={() => toggleCity(city)}
                        >
                          <td colSpan={7} className="p-4 pl-5 tracking-wide text-sm flex items-center gap-2">
                            {collapsedCities.has(city) ? <ChevronRight className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            <span className="font-bold">{city}</span>
                            <span className="ml-2 text-slate-500 font-medium lowercase">
                              ({cityCohorts.length} {cityCohorts.length > 1 ? t('table.cohorts').toLowerCase() : t('table.cohort').toLowerCase()})
                            </span>
                          </td>
                        </tr>
                        {!collapsedCities.has(city) && cityCohorts.map((c) => {
                          const phaseStyles = getPhaseStyles(c.phase);
                          return (
                            <tr key={c.id} className="hover:bg-slate-50/50 transition-colors group">
                              <td className="p-5 text-slate-600 font-medium">{c.ville}</td>
                              <td className="p-5 font-bold text-slate-900">{c.id}</td>
                              <td className="p-5">
                                <span className={`inline-block px-3 py-1 rounded text-[0.75rem] font-bold uppercase mb-1 border ${phaseStyles.badge}`}>
                                  {t(`phases.${getPhaseTranslationKey(c.phase)}`)}
                                </span>
                                {c.parcours && (
                                  <div className="text-[0.75rem] font-bold text-[#3b2c6b] uppercase mb-1">
                                    {formatDisplayLabel(t(`parcours.${c.parcours}`))}
                                  </div>
                                )}
                                <div className="text-slate-700 font-medium text-lg">{t(`steps.${c.etape}`)}</div>
                              </td>
                              <td className="p-5 text-sm text-slate-500">
                                <div>{i18n.language === 'en' ? 'From' : 'Du'} {formatDate(c.debut)}</div>
                                <div>{i18n.language === 'en' ? 'To' : 'Au'} {formatDate(c.fin)}</div>
                              </td>
                              <td className="p-5 w-48">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[0.75rem] font-bold text-slate-600">{Math.round(c.avancement * 100)}%</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${c.avancement * 100}%` }}
                                    transition={{ duration: 1, ease: "easeOut" }}
                                    className={`h-full ${phaseStyles.bar}`} 
                                  />
                                </div>
                              </td>
                              <td className="p-5">
                                <div className="text-sm">
                                  {renderProgressStatus(c.avancement)}
                                </div>
                              </td>
                              <td className="p-5">
                                <div className="flex flex-col gap-2">
                                  <span className="text-sm text-slate-500 line-clamp-2 italic">"{c.actions}"</span>
                                  <button 
                                    onClick={() => askAI(c)}
                                    className="flex items-center gap-1.5 text-[0.75rem] font-bold uppercase text-[#3b2c6b] bg-[#3b2c6b]/10 hover:bg-[#3b2c6b]/20 px-4 py-2 rounded transition-all w-fit opacity-0 group-hover:opacity-100 focus:opacity-100 border border-[#3b2c6b]/20"
                                  >
                                    <span className="flex items-center gap-1"><Sparkles className="w-3 h-3" /> ✨ {t('action.askAI')}</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </motion.div>
            ) : activeTab === 'manage' ? (
              <motion.div 
                key="manage"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-6"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-slate-800">{t('form.manageTitle')}</h2>
                  <button 
                    onClick={() => setIsAdding(true)}
                    className="flex items-center gap-2 bg-[#3b2c6b] hover:bg-[#2a1f4c] text-white px-4 py-2 rounded-lg shadow-sm transition-all font-medium active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    {t('action.addCohort')}
                  </button>
                </div>
                <div className="overflow-x-auto border border-gray-100 rounded-lg">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 border-b border-gray-200 text-sm">
                        <th className="p-4 font-semibold">{t('table.city')}</th>
                        <th className="p-4 font-semibold">{t('table.name')}</th>
                        <th className="p-4 font-semibold">{t('table.phase')}</th>
                        <th className="p-4 font-semibold">{t('table.status')}</th>
                        <th className="p-4 font-semibold">{t('table.actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-gray-100">
                      {sortedCohorts.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 text-slate-600 font-medium">{c.ville}</td>
                          <td className="p-4 font-bold text-slate-900">{c.id}</td>
                          <td className="p-4 text-slate-600">
                            {t(`phases.${getPhaseTranslationKey(c.phase)}`)}
                            {c.parcours && (
                              <div className="text-[0.625rem] font-bold text-[#3b2c6b] uppercase mt-1 opacity-70">
                                {formatDisplayLabel(t(`parcours.${c.parcours}`))}
                                {c.sousEtape && (
                                  <span className="ml-1 text-slate-400">• {t(`courses.${c.sousEtape}`)}</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="p-4">
                            {renderProgressStatus(c.avancement, 'badge')}
                          </td>
                          <td className="p-4">
                            <div className="flex gap-2">
                              <button 
                                onClick={() => setEditingCohort(c)}
                                className="p-2 text-[#3b2c6b] hover:bg-[#3b2c6b]/10 rounded-lg transition-colors"
                                title={t('action.edit')}
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => setCohortToDelete(c)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title={t('action.delete')}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Cities Management Section */}
                <div className="mt-12">
                  <h2 className="text-xl font-bold text-slate-800 mb-6">{t('form.manageCitiesTitle')}</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {cities.map(city => (
                      <div key={city} className="bg-white border border-gray-100 rounded-xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-all group">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#3b2c6b]/5 flex items-center justify-center text-[#3b2c6b]">
                            <Globe className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{city}</div>
                            <div className="text-[0.625rem] font-bold text-slate-400 uppercase">
                              {cohorts.filter(c => normalizeCityName(c.ville) === city).length} {cohorts.filter(c => normalizeCityName(c.ville) === city).length > 1 ? t('table.cohorts') : t('table.cohort')}
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => setCityToDelete(city)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                          title={t('action.delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="gantt"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-6 overflow-x-auto"
              >
                <div className="min-w-[62.5rem]">
                  <div className="flex border-b border-gray-200 pb-2 mb-4">
                    <div className="w-1/4 pr-4 font-bold text-[#3b2c6b] text-base flex items-end">{t('table.cohorts')}</div>
                    <div className="w-3/4 flex relative text-[#3b2c6b] text-sm font-bold uppercase tracking-wider">
                      {QUARTERS.map(q => (
                        <div key={q} className="flex-1 text-center border-l border-gray-100 pl-2 text-left">{i18n.language === 'en' ? q.replace('T', 'Q') : q}</div>
                      ))}
                    </div>
                  </div>
                  <div className="relative pt-2">
                    {/* Grid Lines */}
                    <div className="absolute inset-y-0 right-0 w-3/4 flex pointer-events-none">
                      {QUARTERS.map((q) => (
                        <div key={q} className="flex-1 border-l border-dashed border-gray-200 h-full"></div>
                      ))}
                    </div>
                    {/* Rows */}
                    {sortedCohorts.map(c => {
                      const s = new Date(c.debut).getTime();
                      let e = new Date(c.fin).getTime();
                      if (e < s) e = s + (1000 * 60 * 60 * 24 * 7);
                      const left = ((s - TIME_MIN) / TOTAL_DURATION) * 100;
                      const width = ((e - s) / TOTAL_DURATION) * 100;
                      const phaseStyles = getPhaseStyles(c.phase);

                      return (
                        <div key={c.id} className="flex items-center mb-6 relative z-10 h-12">
                          <div className="w-1/4 pr-4">
                            <div className="font-bold text-xs text-slate-800 truncate">{c.id}</div>
                            <div className="text-[0.625rem] text-slate-400 uppercase font-bold tracking-tight">
                              {Math.round(c.avancement * 100)}% • {t(`status.${getStatusKey(getStatusFromProgress(c.avancement))}`)}
                            </div>
                          </div>
                          <div className="w-3/4 h-8 relative">
                            <motion.div 
                              initial={{ opacity: 0, scaleX: 0 }}
                              animate={{ opacity: 1, scaleX: 1 }}
                              style={{ left: `${left}%`, width: `${width}%`, transformOrigin: 'left' }}
                              className="absolute inset-y-0 rounded shadow-sm border border-black/5 flex items-center overflow-hidden bg-gray-50"
                            >
                              <div 
                                className={`absolute left-0 top-0 h-full opacity-40 ${phaseStyles.bar}`} 
                                style={{ width: `${c.avancement * 100}%` }}
                              />
                              <span className="relative z-10 text-[0.5625rem] font-bold uppercase whitespace-nowrap px-2 text-slate-700">
                                {t(`phases.${getPhaseTranslationKey(c.phase)}`)} : {t(`steps.${c.etape}`)}
                              </span>
                            </motion.div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Legend */}
                  <div className="mt-8 flex items-center justify-center gap-6 text-xs text-slate-500 border-t border-gray-100 pt-4 flex-wrap">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-slate-400"></div> Phase 0</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-amber-400"></div> Phase 1</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-blue-400"></div> Phase 2</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-indigo-400"></div> Phase 3</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-emerald-400"></div> Phase 4</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-fuchsia-400"></div> Phase 5</div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {(isAdding || editingCohort) && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setIsAdding(false); setEditingCohort(null); }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto flex flex-col relative z-10"
            >
              <div className="bg-slate-900 px-6 py-3 flex items-center justify-between sticky top-0 z-20">
                <h3 className="font-bold text-lg text-white">
                  {isAdding ? t('form.addTitle') : t('form.editTitle')}
                </h3>
                <button 
                  onClick={() => { setIsAdding(false); setEditingCohort(null); }}
                  className="text-white/80 hover:text-white transition-colors p-1 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  
                  const etape = modalEtape;
                  const phase = modalPhase;
                  const sousEtape = modalSousEtape;
                  const avancement = getProgressFromStep(etape, modalParcours);
                  const statut = getStatusFromProgress(avancement) as Cohort['statut'];

                  const id = formData.get('id') as string;
                  const villeInput = formData.get('ville') as string;
                  const ville = normalizeCityName(villeInput || extractCityFromId(id));
                  
                  const newCohort: Cohort = {
                    id,
                    ville,
                    phase,
                    etape,
                    debut: formData.get('debut') as string,
                    fin: formData.get('fin') as string,
                    avancement,
                    statut,
                    actions: formData.get('actions') as string,
                    parcours: modalParcours,
                    sousEtape,
                  };

                  if (isAdding) {
                    setCohorts([...cohorts, newCohort]);
                  } else {
                    setCohorts(cohorts.map(c => c.id === editingCohort?.id ? newCohort : c));
                  }
                  setIsAdding(false);
                  setEditingCohort(null);
                }}
                className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3"
              >
                <div className="flex flex-col gap-1">
                  <label className="text-[0.625rem] font-bold text-slate-500 uppercase">{t('table.city')}</label>
                  <input name="ville" defaultValue={editingCohort?.ville} required placeholder={t('table.city')} className="border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-[#3b2c6b] outline-none text-sm" />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[0.625rem] font-bold text-slate-500 uppercase">{t('table.taskName')}</label>
                  <input name="id" defaultValue={editingCohort?.id} required placeholder={t('form.placeholderId')} className="border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-[#3b2c6b] outline-none text-sm" />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[0.625rem] font-bold text-slate-500 uppercase">{t('table.phase')}</label>
                  <select 
                    value={modalPhase} 
                    onChange={(e) => handlePhaseChange(e.target.value)}
                    required
                    className="border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-[#3b2c6b] outline-none bg-white text-sm"
                  >
                    <option value="">{t('form.selectPhase')}</option>
                    {Object.keys(PHASE_STEPS).map(p => (
                      <option key={p} value={p}>{t(`phases.${p}`)}</option>
                    ))}
                  </select>
                </div>

                {modalPhase === "Phase 3 : Certification" ? (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-[0.625rem] font-bold text-slate-500 uppercase">{t('form.selectParcours')}</label>
                      <select 
                        value={modalParcours} 
                        onChange={(e) => handleParcoursChange(e.target.value)}
                        required
                        className="border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-[#3b2c6b] outline-none bg-white text-sm"
                      >
                        <option value="">{t('form.selectParcoursPlaceholder')}</option>
                        {Object.keys(PHASE_3_PARCOURS).map(pk => (
                          <option key={pk} value={pk}>{formatDisplayLabel(t(`parcours.${pk}`))}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1 md:col-span-2">
                      <label className="text-[0.625rem] font-bold text-slate-500 uppercase">{t('table.step')}</label>
                      <select 
                        value={modalEtape} 
                        onChange={(e) => handleEtapeChange(e.target.value)}
                        required
                        disabled={!modalParcours}
                        className="border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-[#3b2c6b] outline-none bg-white disabled:bg-gray-50 disabled:text-slate-400 text-sm"
                      >
                        <option value="">{t('form.selectStep')}</option>
                        {modalParcours && PHASE_3_PARCOURS[modalParcours].map(s => (
                          <option key={s} value={s}>{t(`steps.${s}`)}</option>
                        ))}
                      </select>
                    </div>

                    {modalEtape && CERTIFICATION_COURS[modalEtape] && (
                      <div className="flex flex-col gap-1 md:col-span-2">
                        <label className="text-[0.625rem] font-bold text-slate-500 uppercase">{t('table.sousEtape')}</label>
                        <select 
                          value={modalSousEtape} 
                          onChange={(e) => setModalSousEtape(e.target.value)}
                          required
                          className="border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-[#3b2c6b] outline-none bg-white text-sm"
                        >
                          <option value="">{t('form.selectSousEtape')}</option>
                          {CERTIFICATION_COURS[modalEtape].map(c => (
                            <option key={c} value={c}>{t(`courses.${c}`)}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col gap-1">
                    <label className="text-[0.625rem] font-bold text-slate-500 uppercase">{t('table.step')}</label>
                    <select 
                      value={modalEtape} 
                      onChange={(e) => handleEtapeChange(e.target.value)}
                      required
                      className="border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-[#3b2c6b] outline-none bg-white text-sm"
                    >
                      <option value="">{t('form.selectStep')}</option>
                      {modalPhase && PHASE_STEPS[modalPhase] ? (
                        PHASE_STEPS[modalPhase].map(s => (
                          <option key={s} value={s}>{t(`steps.${s}`)}</option>
                        ))
                      ) : (
                        ALL_STEPS.map(s => (
                          <option key={s} value={s}>{t(`steps.${s}`)}</option>
                        ))
                      )}
                    </select>
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  <label className="text-[0.625rem] font-bold text-slate-500 uppercase">{t('table.startDate')}</label>
                  <input type="date" name="debut" defaultValue={editingCohort?.debut} required className="border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-[#3b2c6b] outline-none text-sm" />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[0.625rem] font-bold text-slate-500 uppercase">{t('table.endDate')}</label>
                  <input type="date" name="fin" defaultValue={editingCohort?.fin} required className="border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-[#3b2c6b] outline-none text-sm" />
                </div>

                <div className="flex flex-col gap-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <label className="text-[0.5625rem] font-bold text-slate-400 uppercase">{t('table.progress')} ({t('form.automatic')})</label>
                  <div className="text-base font-bold text-slate-700">
                    {modalEtape ? Math.round(getProgressFromStep(modalEtape, modalParcours) * 100) : 0}%
                  </div>
                </div>

                <div className="flex flex-col gap-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <label className="text-[0.5625rem] font-bold text-slate-400 uppercase">{t('table.status')} ({t('form.automatic')})</label>
                  <div className="flex items-center gap-2 text-base font-bold text-slate-700">
                    {modalEtape ? (
                      <>
                        {renderProgressStatus(getProgressFromStep(modalEtape, modalParcours))}
                      </>
                    ) : "-"}
                  </div>
                </div>

                <div className="flex flex-col gap-1 md:col-span-2">
                  <label className="text-[0.625rem] font-bold text-slate-500 uppercase">{t('form.actionsNotes')}</label>
                  <textarea name="actions" defaultValue={editingCohort?.actions} placeholder={t('form.placeholderActions')} className="border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-[#3b2c6b] outline-none h-20 text-sm" />
                </div>
                <div className="md:col-span-2 flex justify-end gap-3 mt-3">
                  <button 
                    type="button"
                    onClick={() => { setIsAdding(false); setEditingCohort(null); }}
                    className="px-6 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    {t('action.cancel')}
                  </button>
                  <button 
                    type="submit"
                    className="px-6 py-2 bg-[#3b2c6b] text-white rounded-lg hover:bg-[#2a1f4c] transition-colors font-medium flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {t('action.save')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI Modal */}
      <AnimatePresence>
        {selectedCohort && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCohort(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[95vh] overflow-y-auto flex flex-col relative z-10"
            >
              <div className="bg-gradient-to-r from-[#3b2c6b] to-[#2a1f4c] px-6 py-3 flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-2 text-white">
                  <Sparkles className="w-5 h-5" />
                  <h3 className="font-bold text-lg">{t('ai.title')}</h3>
                </div>
                <button 
                  onClick={() => setSelectedCohort(null)}
                  className="text-white/80 hover:text-white transition-colors bg-white/10 hover:bg-white/20 p-1 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 flex-1 overflow-y-auto max-h-[70vh]">
                <div className="mb-6 pb-4 border-b border-gray-100">
                  <p className="text-[0.625rem] text-slate-400 uppercase font-bold tracking-widest">{t('ai.analysisFor')}</p>
                  <p className="text-xl font-bold text-slate-800">{selectedCohort.id}</p>
                  <div className="flex gap-2 mt-2">
                    <span className="text-[0.625rem] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded uppercase">{t(`phases.${getPhaseTranslationKey(selectedCohort.phase)}`)}</span>
                    <span className="text-[0.625rem] font-bold bg-[#a0a0a0]/10 text-[#606060] px-2 py-1 rounded uppercase">{Math.round(selectedCohort.avancement * 100)}%</span>
                  </div>
                </div>
                
                {isAiLoading ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-4 text-[#3b2c6b]">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <p className="text-sm font-medium animate-pulse">{t('ai.loading')}</p>
                  </div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-slate-700 prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed"
                  >
                    {aiResult}
                  </motion.div>
                )}
              </div>
              <div className="p-4 bg-gray-50 border-t border-gray-100 text-[0.625rem] text-center text-slate-400 uppercase tracking-widest font-bold">
                Moteur : Google Gemini 3 Flash
              </div>
            </motion.div>
          </div>
        )}

        {isContactOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#3b2c6b]/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            onClick={() => !isContactSending && setIsContactOpen(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[95vh] overflow-y-auto relative"
            >
              <div className="bg-gradient-to-br from-[#5e35b1] to-[#3b2c6b] p-6 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-400/20 rounded-full -ml-12 -mb-12 blur-xl"></div>
                
                <button 
                  onClick={() => setIsContactOpen(false)}
                  className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors bg-white/10 hover:bg-white/20 p-2 rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="relative z-10">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-md border border-white/20">
                    <Mail className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">{t('contact.title')}</h3>
                  <p className="text-purple-100 text-sm font-medium opacity-90">
                    {t('contact.messagePlaceholder')}
                  </p>
                </div>
              </div>

              <div className="p-6">
                {contactSuccess ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center py-8 text-center"
                  >
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                      <Check className="w-8 h-8" />
                    </div>
                    <h4 className="text-xl font-bold text-slate-800 mb-2">{t('contact.success')}</h4>
                    <p className="text-slate-500 text-sm">{t('contact.success')}</p>
                  </motion.div>
                ) : (
                  <form onSubmit={handleContactSubmit} className="space-y-5">
                    <div>
                      <label className="block text-[0.625rem] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">
                        {t('contact.emailLabel')}
                      </label>
                      <input 
                        type="email"
                        required
                        value={contactForm.email}
                        onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                        placeholder={t('contact.emailPlaceholder')}
                        className="w-full px-4 py-3 rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5e35b1]/20 focus:border-[#5e35b1] transition-all text-sm font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[0.625rem] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">
                        {t('contact.messageLabel')}
                      </label>
                      <textarea 
                        required
                        rows={4}
                        value={contactForm.message}
                        onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                        placeholder={t('contact.messagePlaceholder')}
                        className="w-full px-4 py-3 rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5e35b1]/20 focus:border-[#5e35b1] transition-all text-sm font-medium resize-none"
                      />
                    </div>
                    <button 
                      type="submit"
                      disabled={isContactSending}
                      className="w-full py-4 bg-[#5e35b1] hover:bg-[#4527a0] text-white rounded-2xl font-bold text-sm shadow-lg shadow-purple-200 hover:shadow-purple-300 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                    >
                      {isContactSending ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Send className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                          {t('contact.send')}
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {(cohortToDelete || cityToDelete) && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setCohortToDelete(null); setCityToDelete(null); setDeleteError(null); }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative z-10"
            >
              <div className="p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  {cohortToDelete ? t('form.confirmDeleteCohortTitle') : t('form.confirmDeleteCityTitle')}
                </h3>
                <p className="text-slate-500 mb-6">
                  {cohortToDelete 
                    ? t('form.confirmDeleteCohortDesc', { id: cohortToDelete.id }) 
                    : t('form.confirmDeleteCityDesc', { city: cityToDelete })}
                </p>

                {deleteError && (
                  <div className="mb-6 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2 text-left">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <p className="text-xs font-medium text-red-800">{deleteError}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button 
                    onClick={() => { setCohortToDelete(null); setCityToDelete(null); setDeleteError(null); }}
                    className="flex-1 px-4 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
                  >
                    {t('action.cancel')}
                  </button>
                  <button 
                    onClick={() => {
                      if (cohortToDelete) handleDeleteCohort(cohortToDelete);
                      else if (cityToDelete) handleDeleteCity(cityToDelete);
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-200 transition-all active:scale-95"
                  >
                    {t('action.confirmDelete')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="bg-[#faf9fc] border-t border-purple-100 py-8 px-4 md:px-8 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          {/* Bloc gauche (IDENTITÉ) */}
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shrink-0 shadow-sm p-3 border border-purple-50">
              <Logo className="w-full h-full object-contain" />
            </div>
            <div className="text-center md:text-left flex flex-col justify-center">
              <p className="text-xl font-bold text-[#3b2c6b] leading-tight">
                Mme Imane EL-OUTAR
              </p>
              <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                CHEFFE DE PROJET WEB4JOBS
              </p>
            </div>
          </div>

          {/* Bloc droit (CONTACT) */}
          <div className="flex flex-col items-center md:items-center gap-3">
            <h3 className="text-[#3b2c6b] font-bold uppercase tracking-widest text-[0.5625rem] bg-purple-100/50 px-3 py-1 rounded-full">
              Contact
            </h3>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsContactOpen(true)}
                className="w-11 h-11 rounded-xl bg-white flex items-center justify-center hover:bg-[#5e35b1] hover:text-white text-[#5e35b1] transition-all shadow-sm hover:shadow-lg active:scale-95 border border-purple-50 group"
                title="Envoyer un email"
              >
                <Mail className="w-5 h-5 group-hover:scale-110 transition-transform" strokeWidth={2} />
              </button>
              <a 
                href="https://wa.me/212669505599" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="w-11 h-11 rounded-xl bg-white flex items-center justify-center hover:bg-[#5e35b1] hover:text-white text-[#5e35b1] transition-all shadow-sm hover:shadow-lg active:scale-95 border border-purple-50 group"
                title="Contacter sur WhatsApp"
              >
                <MessageCircle className="w-5 h-5 group-hover:scale-110 transition-transform" strokeWidth={2} />
              </a>
              <a 
                href="https://www.linkedin.com/in/imane-el-outar-a99ba770" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="w-11 h-11 rounded-xl bg-white flex items-center justify-center hover:bg-[#5e35b1] hover:text-white text-[#5e35b1] transition-all shadow-sm hover:shadow-lg active:scale-95 border border-purple-50 group"
                title="Voir le profil LinkedIn"
              >
                <Linkedin className="w-5 h-5 group-hover:scale-110 transition-transform" strokeWidth={2} />
              </a>
            </div>
            <p className="text-sm text-slate-500 font-medium">i.eloutar@web4jobs.ma</p>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto mt-12 pt-6 border-t border-purple-100/50 flex flex-col items-center gap-3">
          <p className="text-sm text-slate-400 font-medium text-center">
            © 2026 Mme Imane EL-OUTAR. All rights reserved.
          </p>
          <div className="flex gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-purple-200"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-purple-200"></div>
          </div>
        </div>
      </footer>
    </div>
  );
}
