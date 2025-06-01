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
export const DEFAULT_DISPLACEMENT_MAP = 'https://via.placeholder.com/512x512/808080/808080';

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
    path: 'https://via.placeholder.com/1200x1200/ffffff/ffffff?text=T-Shirt+White',
    displacementMap: DEFAULT_DISPLACEMENT_MAP,
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
    path: 'https://via.placeholder.com/1200x1200/222222/222222?text=T-Shirt+Black',
    displacementMap: DEFAULT_DISPLACEMENT_MAP,
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
    path: 'https://via.placeholder.com/1200x1200/f5f5f5/f5f5f5?text=Hoodie+White',
    displacementMap: DEFAULT_DISPLACEMENT_MAP,
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
    path: 'https://via.placeholder.com/1200x1200/333333/333333?text=Hoodie+Black',
    displacementMap: DEFAULT_DISPLACEMENT_MAP,
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