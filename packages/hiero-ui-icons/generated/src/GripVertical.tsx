import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type GripVerticalProps = {
  size?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
  label?: string;
  reduceMotion?: boolean | 'system';
  variant?: "v-16" | "v-24" | "16" | "24" | number;
  effect?: never;
  animate?: boolean;
};

const iconData = {
  "id": "grip-vertical",
  "name": "gripVertical",
  "variants": {
    "v-16": {
      "id": "v-16",
      "name": "16",
      "size": 16,
      "viewBox": [
        0,
        0,
        24,
        24
      ],
      "layers": {
        "circle": {
          "id": "circle",
          "path": {
            "d": "M9 11 C9.552 11 10 11.448 10 12 C10 12.552 9.552 13 9 13 C8.448 13 8 12.552 8 12 C8 11.448 8.448 11 9 11 Z"
          },
          "style": {
            "stroke": {
              "mode": "currentColor"
            },
            "strokeWidth": 2,
            "lineCap": "round",
            "lineJoin": "round"
          }
        },
        "circle-2": {
          "id": "circle-2",
          "path": {
            "d": "M9 4 C9.552 4 10 4.448 10 5 C10 5.552 9.552 6 9 6 C8.448 6 8 5.552 8 5 C8 4.448 8.448 4 9 4 Z"
          },
          "style": {
            "stroke": {
              "mode": "currentColor"
            },
            "strokeWidth": 2,
            "lineCap": "round",
            "lineJoin": "round"
          }
        },
        "circle-3": {
          "id": "circle-3",
          "path": {
            "d": "M9 18 C9.552 18 10 18.448 10 19 C10 19.552 9.552 20 9 20 C8.448 20 8 19.552 8 19 C8 18.448 8.448 18 9 18 Z"
          },
          "style": {
            "stroke": {
              "mode": "currentColor"
            },
            "strokeWidth": 2,
            "lineCap": "round",
            "lineJoin": "round"
          }
        },
        "circle-4": {
          "id": "circle-4",
          "path": {
            "d": "M15 11 C15.552 11 16 11.448 16 12 C16 12.552 15.552 13 15 13 C14.448 13 14 12.552 14 12 C14 11.448 14.448 11 15 11 Z"
          },
          "style": {
            "stroke": {
              "mode": "currentColor"
            },
            "strokeWidth": 2,
            "lineCap": "round",
            "lineJoin": "round"
          }
        },
        "circle-5": {
          "id": "circle-5",
          "path": {
            "d": "M15 4 C15.552 4 16 4.448 16 5 C16 5.552 15.552 6 15 6 C14.448 6 14 5.552 14 5 C14 4.448 14.448 4 15 4 Z"
          },
          "style": {
            "stroke": {
              "mode": "currentColor"
            },
            "strokeWidth": 2,
            "lineCap": "round",
            "lineJoin": "round"
          }
        },
        "circle-6": {
          "id": "circle-6",
          "path": {
            "d": "M15 18 C15.552 18 16 18.448 16 19 C16 19.552 15.552 20 15 20 C14.448 20 14 19.552 14 19 C14 18.448 14.448 18 15 18 Z"
          },
          "style": {
            "stroke": {
              "mode": "currentColor"
            },
            "strokeWidth": 2,
            "lineCap": "round",
            "lineJoin": "round"
          }
        }
      },
      "defaultType": "default",
      "types": {
        "default": {
          "id": "default",
          "layers": {
            "circle": {
              "id": "circle",
              "path": {
                "d": "M9 11 C9.552 11 10 11.448 10 12 C10 12.552 9.552 13 9 13 C8.448 13 8 12.552 8 12 C8 11.448 8.448 11 9 11 Z"
              },
              "style": {
                "stroke": {
                  "mode": "currentColor"
                },
                "strokeWidth": 2,
                "lineCap": "round",
                "lineJoin": "round"
              }
            },
            "circle-2": {
              "id": "circle-2",
              "path": {
                "d": "M9 4 C9.552 4 10 4.448 10 5 C10 5.552 9.552 6 9 6 C8.448 6 8 5.552 8 5 C8 4.448 8.448 4 9 4 Z"
              },
              "style": {
                "stroke": {
                  "mode": "currentColor"
                },
                "strokeWidth": 2,
                "lineCap": "round",
                "lineJoin": "round"
              }
            },
            "circle-3": {
              "id": "circle-3",
              "path": {
                "d": "M9 18 C9.552 18 10 18.448 10 19 C10 19.552 9.552 20 9 20 C8.448 20 8 19.552 8 19 C8 18.448 8.448 18 9 18 Z"
              },
              "style": {
                "stroke": {
                  "mode": "currentColor"
                },
                "strokeWidth": 2,
                "lineCap": "round",
                "lineJoin": "round"
              }
            },
            "circle-4": {
              "id": "circle-4",
              "path": {
                "d": "M15 11 C15.552 11 16 11.448 16 12 C16 12.552 15.552 13 15 13 C14.448 13 14 12.552 14 12 C14 11.448 14.448 11 15 11 Z"
              },
              "style": {
                "stroke": {
                  "mode": "currentColor"
                },
                "strokeWidth": 2,
                "lineCap": "round",
                "lineJoin": "round"
              }
            },
            "circle-5": {
              "id": "circle-5",
              "path": {
                "d": "M15 4 C15.552 4 16 4.448 16 5 C16 5.552 15.552 6 15 6 C14.448 6 14 5.552 14 5 C14 4.448 14.448 4 15 4 Z"
              },
              "style": {
                "stroke": {
                  "mode": "currentColor"
                },
                "strokeWidth": 2,
                "lineCap": "round",
                "lineJoin": "round"
              }
            },
            "circle-6": {
              "id": "circle-6",
              "path": {
                "d": "M15 18 C15.552 18 16 18.448 16 19 C16 19.552 15.552 20 15 20 C14.448 20 14 19.552 14 19 C14 18.448 14.448 18 15 18 Z"
              },
              "style": {
                "stroke": {
                  "mode": "currentColor"
                },
                "strokeWidth": 2,
                "lineCap": "round",
                "lineJoin": "round"
              }
            }
          }
        }
      }
    },
    "v-24": {
      "id": "v-24",
      "name": "24",
      "size": 24,
      "viewBox": [
        0,
        0,
        24,
        24
      ],
      "layers": {
        "circle": {
          "id": "circle",
          "path": {
            "d": "M9 11 C9.552 11 10 11.448 10 12 C10 12.552 9.552 13 9 13 C8.448 13 8 12.552 8 12 C8 11.448 8.448 11 9 11 Z"
          },
          "style": {
            "stroke": {
              "mode": "currentColor"
            },
            "strokeWidth": 2,
            "lineCap": "round",
            "lineJoin": "round"
          }
        },
        "circle-2": {
          "id": "circle-2",
          "path": {
            "d": "M9 4 C9.552 4 10 4.448 10 5 C10 5.552 9.552 6 9 6 C8.448 6 8 5.552 8 5 C8 4.448 8.448 4 9 4 Z"
          },
          "style": {
            "stroke": {
              "mode": "currentColor"
            },
            "strokeWidth": 2,
            "lineCap": "round",
            "lineJoin": "round"
          }
        },
        "circle-3": {
          "id": "circle-3",
          "path": {
            "d": "M9 18 C9.552 18 10 18.448 10 19 C10 19.552 9.552 20 9 20 C8.448 20 8 19.552 8 19 C8 18.448 8.448 18 9 18 Z"
          },
          "style": {
            "stroke": {
              "mode": "currentColor"
            },
            "strokeWidth": 2,
            "lineCap": "round",
            "lineJoin": "round"
          }
        },
        "circle-4": {
          "id": "circle-4",
          "path": {
            "d": "M15 11 C15.552 11 16 11.448 16 12 C16 12.552 15.552 13 15 13 C14.448 13 14 12.552 14 12 C14 11.448 14.448 11 15 11 Z"
          },
          "style": {
            "stroke": {
              "mode": "currentColor"
            },
            "strokeWidth": 2,
            "lineCap": "round",
            "lineJoin": "round"
          }
        },
        "circle-5": {
          "id": "circle-5",
          "path": {
            "d": "M15 4 C15.552 4 16 4.448 16 5 C16 5.552 15.552 6 15 6 C14.448 6 14 5.552 14 5 C14 4.448 14.448 4 15 4 Z"
          },
          "style": {
            "stroke": {
              "mode": "currentColor"
            },
            "strokeWidth": 2,
            "lineCap": "round",
            "lineJoin": "round"
          }
        },
        "circle-6": {
          "id": "circle-6",
          "path": {
            "d": "M15 18 C15.552 18 16 18.448 16 19 C16 19.552 15.552 20 15 20 C14.448 20 14 19.552 14 19 C14 18.448 14.448 18 15 18 Z"
          },
          "style": {
            "stroke": {
              "mode": "currentColor"
            },
            "strokeWidth": 2,
            "lineCap": "round",
            "lineJoin": "round"
          }
        }
      },
      "defaultType": "default",
      "types": {
        "default": {
          "id": "default",
          "layers": {
            "circle": {
              "id": "circle",
              "path": {
                "d": "M9 11 C9.552 11 10 11.448 10 12 C10 12.552 9.552 13 9 13 C8.448 13 8 12.552 8 12 C8 11.448 8.448 11 9 11 Z"
              },
              "style": {
                "stroke": {
                  "mode": "currentColor"
                },
                "strokeWidth": 2,
                "lineCap": "round",
                "lineJoin": "round"
              }
            },
            "circle-2": {
              "id": "circle-2",
              "path": {
                "d": "M9 4 C9.552 4 10 4.448 10 5 C10 5.552 9.552 6 9 6 C8.448 6 8 5.552 8 5 C8 4.448 8.448 4 9 4 Z"
              },
              "style": {
                "stroke": {
                  "mode": "currentColor"
                },
                "strokeWidth": 2,
                "lineCap": "round",
                "lineJoin": "round"
              }
            },
            "circle-3": {
              "id": "circle-3",
              "path": {
                "d": "M9 18 C9.552 18 10 18.448 10 19 C10 19.552 9.552 20 9 20 C8.448 20 8 19.552 8 19 C8 18.448 8.448 18 9 18 Z"
              },
              "style": {
                "stroke": {
                  "mode": "currentColor"
                },
                "strokeWidth": 2,
                "lineCap": "round",
                "lineJoin": "round"
              }
            },
            "circle-4": {
              "id": "circle-4",
              "path": {
                "d": "M15 11 C15.552 11 16 11.448 16 12 C16 12.552 15.552 13 15 13 C14.448 13 14 12.552 14 12 C14 11.448 14.448 11 15 11 Z"
              },
              "style": {
                "stroke": {
                  "mode": "currentColor"
                },
                "strokeWidth": 2,
                "lineCap": "round",
                "lineJoin": "round"
              }
            },
            "circle-5": {
              "id": "circle-5",
              "path": {
                "d": "M15 4 C15.552 4 16 4.448 16 5 C16 5.552 15.552 6 15 6 C14.448 6 14 5.552 14 5 C14 4.448 14.448 4 15 4 Z"
              },
              "style": {
                "stroke": {
                  "mode": "currentColor"
                },
                "strokeWidth": 2,
                "lineCap": "round",
                "lineJoin": "round"
              }
            },
            "circle-6": {
              "id": "circle-6",
              "path": {
                "d": "M15 18 C15.552 18 16 18.448 16 19 C16 19.552 15.552 20 15 20 C14.448 20 14 19.552 14 19 C14 18.448 14.448 18 15 18 Z"
              },
              "style": {
                "stroke": {
                  "mode": "currentColor"
                },
                "strokeWidth": 2,
                "lineCap": "round",
                "lineJoin": "round"
              }
            }
          }
        }
      }
    }
  },
  "meta": {
    "externalImport": {
      "adapterId": "lucide",
      "sourceLibrary": "lucide",
      "sourceVersion": "1.8.0",
      "sourceIconId": "grip-vertical",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T04:21:06.190Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function GripVertical({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: GripVerticalProps) {
  return (
    <HieroIcon
      icon={typedIconData}
      size={size}
      color={color}
      className={className}
      style={style}
      label={label}
      reduceMotion={reduceMotion}
      variant={variant}
      animate={animate}
    />
  );
}
