# Mortimer Release Naming Convention

Mortimer is a Canadian-focused mortgage calculator. To celebrate this identity, all releases follow a naming convention inspired by **Canadian Currency & Coins**.

Pre-release and minor versions are named after smaller denominations or historical currency, while major milestones are named after iconic Canadian coins and bills.

---

## Version Mapping

### Pre-Releases (`0.x.y`)
Pre-releases represent early iterations, smaller increments, and initial drafts.

| Version | Codename | Description |
|---|---|---|
| **`0.1.x`** | **Penny** | The humble 1-cent coin (now phased out, but historically iconic). Repesents initial development, setting foundations, and counting the first cents. |
| **`0.2.x`** | **Nickel** | The 5-cent coin, featuring the beaver. Represents early stable components and initial calculations. |
| **`0.3.x`** | **Dime** | The thin, fast 10-cent coin featuring the *Bluenose* sailboat. Represents swift UI rendering and performance improvements. |
| **`0.4.x`** | **Quarter** | The versatile 25-cent coin featuring the caribou. Represents a highly functional, well-rounded release. |
| **`0.5.x`** | **Shinplaster** | The historic Canadian 25-cent paper banknote. Reserved for specialized pre-release stages (e.g., final release candidate testing). |
| **`0.6.x`** | **Half-Dollar** | The rare 50-cent coin featuring the Coat of Arms of Canada. Used for late-stage pre-production features. |

### Major Releases (`X.0.0`)
Major releases represent production-ready milestones with significant updates.

| Version | Codename | Description |
|---|---|---|
| **`1.0.0`** | **Loonie** | The golden 1-dollar coin featuring the common loon. The definitive first production-ready launch of Mortimer. |
| **`2.0.0`** | **Toonie** | The bi-metallic 2-dollar coin featuring the polar bear. Represents the second generation of Mortimer, focusing on scale and expanded features. |
| **`3.0.0`** | **Greenback** | A historic term for paper bank notes. Represents advanced multi-profile tracking and advanced amortization features. |
| **`4.0.0`** | **Gold Maple** | Named after the legendary Canadian Gold Maple Leaf bullion coin. Represents the ultimate premium state of the calculator. |

---

## Semantic Versioning (`MAJOR.MINOR.PATCH`)

Mortimer adheres strictly to [Semantic Versioning (SemVer)](https://semver.org/):

* **MAJOR** changes (e.g., `1.0.0` to `2.0.0`) trigger a new coin/currency codename (e.g., from *Loonie* to *Toonie*).
* **MINOR** changes (e.g., `1.1.0` to `1.2.0`) increment features under the active codename.
* **PATCH** changes (e.g., `1.0.1`) address bug fixes and do not change the release codename.
