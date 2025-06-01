export type PrintMethod = 'screen-print' | 'dtg' | 'embroidery' | 'vinyl';

export interface PrintArea {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  displacementIntensity: number;
}

export interface TemplateConfig {
  id: string;
  name: string;
  path: string;
  displacementMap: string;
  isUserTemplate?: boolean; // Flag for user-uploaded templates
  printAreas: {
    front?: PrintArea;
    back?: PrintArea;
    sleeve?: PrintArea;
  };
  defaultPrintMethod: PrintMethod;
}

// Default print area for user-uploaded templates
export const DEFAULT_PRINT_AREA: PrintArea = {
  x: 50,
  y: 50,
  width: 40,
  height: 40,
  rotation: 0,
  displacementIntensity: 15
};

// Default displacement map for user templates
export const DEFAULT_DISPLACEMENT_MAP = '/mockup-templates/displacement-maps/default-displacement.png';

export const PRODUCT_TEMPLATES: TemplateConfig[] = [
  // Custom template placeholder - will be populated at runtime
  {
    id: 'custom-template',
    name: 'Your Custom Template',
    path: '',
    displacementMap: DEFAULT_DISPLACEMENT_MAP,
    isUserTemplate: true,
    printAreas: {
      front: DEFAULT_PRINT_AREA
    },
    defaultPrintMethod: 'screen-print'
  },
  {
    id: 'tshirt-white',
    name: 'T-Shirt (White)',
    path: '/mockup-templates/tshirt-white.png',
    displacementMap: '/mockup-templates/displacement-maps/tshirt-displacement.png',
    printAreas: {
      front: {
        x: 50,
        y: 40,
        width: 40,
        height: 50,
        rotation: 0,
        displacementIntensity: 15
      },
      back: {
        x: 50,
        y: 40,
        width: 45,
        height: 55,
        rotation: 0,
        displacementIntensity: 15
      }
    },
    defaultPrintMethod: 'screen-print'
  },
  {
    id: 'tshirt-black',
    name: 'T-Shirt (Black)',
    path: '/mockup-templates/tshirt-black.png',
    displacementMap: '/mockup-templates/displacement-maps/tshirt-displacement.png',
    printAreas: {
      front: {
        x: 50,
        y: 40,
        width: 40,
        height: 50,
        rotation: 0,
        displacementIntensity: 15
      },
      back: {
        x: 50,
        y: 40,
        width: 45,
        height: 55,
        rotation: 0,
        displacementIntensity: 15
      }
    },
    defaultPrintMethod: 'screen-print'
  },
  {
    id: 'hoodie-white',
    name: 'Hoodie (White)',
    path: '/mockup-templates/hoodie-white.png',
    displacementMap: '/mockup-templates/displacement-maps/hoodie-displacement.png',
    printAreas: {
      front: {
        x: 50,
        y: 45,
        width: 35,
        height: 35,
        rotation: 0,
        displacementIntensity: 20
      },
      back: {
        x: 50,
        y: 40,
        width: 45,
        height: 50,
        rotation: 0,
        displacementIntensity: 18
      }
    },
    defaultPrintMethod: 'screen-print'
  },
  {
    id: 'hoodie-black',
    name: 'Hoodie (Black)',
    path: '/mockup-templates/hoodie-black.png',
    displacementMap: '/mockup-templates/displacement-maps/hoodie-displacement.png',
    printAreas: {
      front: {
        x: 50,
        y: 45,
        width: 35,
        height: 35,
        rotation: 0,
        displacementIntensity: 20
      },
      back: {
        x: 50,
        y: 40,
        width: 45,
        height: 50,
        rotation: 0,
        displacementIntensity: 18
      }
    },
    defaultPrintMethod: 'screen-print'
  }
]; 