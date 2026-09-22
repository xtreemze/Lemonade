# Developer Tools Guide

Complete guide to Lemonsville's two powerful dev tools for interactive scene development and testing.

---

## Quick Start

### 1. Enable Gizmo (3D Object Manipulation)

```javascript
enableGizmo()
// Then refresh the page
```

**What it does**: Lets you select and move 3D objects in the scene, then export their new positions as code.

**Panel**: Top-left corner with magenta border

### 2. Enable Scene Launcher (Weather & Phase Testing)

```javascript
enableSceneLauncher()
// Then refresh the page
```

**What it does**: Launch scenes with different weather conditions, phases, and customer activity levels with one click.

**Panel**: Bottom-right corner with cyan border

### Using Both Together

Enable both tools for the ultimate dev experience:
```javascript
enableGizmo()
enableSceneLauncher()
// Refresh page
```

Now you can:
1. Launch different scenes with the launcher
2. Manipulate objects with the gizmo in each scenario
3. Export final positions when satisfied

---

## 🎨 Gizmo Dev Tool (3D Object Editor)

### Location
**Top-left corner** - Magenta border panel

### Features

#### Selection & Hovering
- **Click** 3D objects to select them
- **Magenta bounding box** appears around selected objects
- Hover shows selectable objects with pointer cursor
- **ESC** to deselect

#### Transform Modes
| Key | Mode | Action |
|-----|------|--------|
| `G` | **Move** | Translate objects in XY plane |
| `R` | **Rotate** | Rotate objects (preview mode) |
| `S` | **Scale** | Scale objects (preview mode) |

#### Real-Time Display
Shows selected object's current values:
- **Name**: Object identifier
- **Position**: X, Y, Z coordinates
- **Rotation**: X, Y, Z angles in radians
- **Scale**: X, Y, Z scale factors

#### Export Options

**💾 Save Transform**
- Saves current object's position, rotation, and scale
- Shows count of saved objects

**📋 Export JSON**
- Downloads all saved transforms as `scene-transforms.json`
- Share with team, store in version control

**📝 Export Code**
- Downloads as TypeScript: `scene-transforms.ts`
- Ready to paste into scene code
- Includes object names and coordinates

**📋 Copy JSON**
- Copies all transforms to clipboard
- Paste into Slack, chat, or notes

### Workflow Example

```
1. Click on lemonade stand
   → Magenta box appears
   
2. Press 'G' to enter Move mode
   → Button turns magenta

3. Drag stand to new position
   → Info panel updates live

4. Click '💾 Save Transform'
   → Saved count increments

5. Click '📝 Export Code'
   → TypeScript file downloads

6. In src code, apply the new position:
   stand.position.set(newX, newY, newZ)
```

### Keyboard Shortcuts
```
G          = Move mode
R          = Rotate mode
S          = Scale mode
ESC        = Deselect object
Left Drag  = Transform in current mode
```

### Console Commands
```javascript
enableGizmo()          // Enable
disableGizmo()         // Disable
gizmoHelp()            // Show help
```

### Tips
- **Z-Depth**: Objects maintain their Z; dragging affects X/Y
- **Multiple Objects**: Save many in one session, export all together
- **Real-time**: See changes instantly; no code recompile needed
- **Collaboration**: Export JSON and share with teammates
- **Precision**: Use small drags for fine adjustments

---

## 🎬 Scene Launcher (Weather & Phase Testing)

### Location
**Bottom-right corner** - Cyan border panel

### Features

#### Preset Scenes
20+ pre-configured scenes covering:

**Weather Conditions**
- ☀️ Sunny
- ☁️ Cloudy  
- 🌤️ Partly Cloudy (hot-and-dry)
- ⛈️ Thunderstorm

**Phases**
- 📋 Forecast (planning preview)
- 💤 Idle (closed/inactive)
- 🎬 Simulation (active with customers)

**Customer Activity Levels** (Confidence)
- 0 = Quiet (no customers)
- 1 = Light traffic
- 2 = Steady flow (moderate)
- 3 = Lively activity (busy)
- 4 = Very busy (peak)
- 5 = Extreme rush (maximum)

#### Preset Buttons
Click any button to instantly launch that scene:
- "☀️ Sunny Forecast" - Sunny weather, planning view
- "⛈️ Thunderstorm - Steady" - Storm with moderate activity
- "☀️ Sunny - Very Busy (5 confidence)" - Peak conditions

#### Custom Scene Creator
**Weather Dropdown**
- sunny, cloudy, hot-and-dry, thunderstorm
- Default: sunny

**Phase Dropdown**
- forecast, idle, simulation
- Default: forecast

**Confidence Slider**
- Range: 0-5
- Default: 2 (steady)
- See label update in real-time

**🎬 Launch Custom Scene Button** (Green)
- Creates custom scene from selections
- Updates scene instantly
- Does not change game state (just presentation)

### Preset List

#### Forecast Presets (Planning Phase)
```
☀️  Sunny Forecast
☁️  Cloudy Forecast
🌤️  Partly Cloudy Forecast
⛈️  Thunderstorm Forecast
```

#### Idle Presets (Closed/Inactive)
```
🌅 Sunny - Idle
🌄 Cloudy - Idle
```

#### Quiet (0 confidence - no customers)
```
☀️ Sunny - Quiet (0 confidence)
☁️ Cloudy - Quiet
```

#### Light (1 confidence - light traffic)
```
☀️ Sunny - Light (1 confidence)
☁️ Cloudy - Light
```

#### Steady (2 confidence - moderate)
```
☀️ Sunny - Steady (2 confidence)
☁️ Cloudy - Steady
⛈️ Thunderstorm - Steady
```

#### Lively (3 confidence - busy)
```
☀️ Sunny - Lively (3 confidence)
🌤️ Partly Cloudy - Lively
```

#### Busy (4 confidence - very busy)
```
☀️ Sunny - Busy (4 confidence)
```

#### Very Busy (5 confidence - maximum)
```
☀️ Sunny - Very Busy (5 confidence)
```

### Workflow Example

```
1. Click "⛈️ Thunderstorm - Steady"
   → Scene updates to storm with moderate activity
   → Seller mood adjusts
   → Customer crowds respond

2. Observe scene behavior
   → Check visibility, lighting, animations
   → Note customer patterns

3. Try custom: Set to "simulation", confidence 5
   → Click "🎬 Launch Custom Scene"
   → Scene runs at maximum customer activity
   → Great for stress testing

4. Switch to "☀️ Sunny - Light (1 confidence)"
   → Scene becomes calm
   → Few customers visible
   → Perfect for UI testing
```

### Scene State Info

When you launch a scene, these values are set:

```typescript
environment: {
  weather: SceneWeather,      // sunny, cloudy, hot-and-dry, thunderstorm
  temperature: number,        // Auto-adjusted by weather
}
phase: ScenePhase,            // "forecast", "idle", or "simulation"
confidence: number,           // 0-5 (customer activity level)
prepared: number,             // Cups prepared (default: 5-25)
visibleSigns: number,         // Advertising signs (default: 1-5)
sold: number,                 // Cups sold (default: 0-22)
```

### Console Commands
```javascript
enableSceneLauncher()          // Enable
disableSceneLauncher()         // Disable
sceneLauncherHelp()            // Show help
SCENE_PRESETS                  // View all presets (array)
```

### Tips
- **Forecast Scouting**: Use forecast presets to see weather before committing
- **Idle Testing**: Check UI without customer activity
- **Stress Testing**: Launch "Very Busy" (5 confidence) to test performance
- **Weather Comparison**: Quickly switch between weathers for the same phase
- **Custom Combos**: Make unusual combinations (e.g., Thunderstorm + Very Busy) for edge cases

---

## Using Both Tools Together

### Integrated Workflow

**Step 1: Explore Weather Variations**
```
1. Enable Scene Launcher
2. Click through presets to see different weathers
3. Note which phase/weather combos need adjustment
```

**Step 2: Position Objects for Conditions**
```
1. Enable Gizmo
2. Refresh (both tools active)
3. Launch a specific scene
4. Move objects to optimal positions for that weather
5. Save the transform
```

**Step 3: Test All Variations**
```
1. Launch different preset
2. Verify object positions still work
3. Adjust if needed
4. Save new positions
```

**Step 4: Export and Apply**
```
1. In gizmo, click "📝 Export Code"
2. Apply all changes to scene code
3. Commit and push
```

### Example: Repositioning Signs for Weather

**Scenario**: Signs blow around in thunderstorms; move them for safety

```
1. enableGizmo()
2. enableSceneLauncher()
3. Refresh page
4. Click "⛈️ Thunderstorm Forecast"
5. Click on a sign to select it (magenta box)
6. Press 'G' for move mode
7. Drag sign to safer position
8. Click "💾 Save Transform"
9. Repeat for each sign
10. Click "📝 Export Code"
11. Apply to src/index.ts
```

### Example: Tuning Actor Positions

**Scenario**: Seller positioning looks off at different phases

```
1. enableGizmo()
2. enableSceneLauncher()
3. Refresh page
4. Launch "☀️ Sunny - Very Busy (5 confidence)"
5. Select seller (person mesh)
6. Move to optimal position for busy scene
7. Save transform
8. Launch "☁️ Cloudy - Quiet"
9. Check if position still works
10. If not, fine-tune and save another variant
11. Export both and apply to code
```

---

## localStorage Flags

### Enable/Disable Without Console

Manually set localStorage flags:

```javascript
// Enable Gizmo
localStorage.setItem('LEMONADE_DEV_GIZMO', '1')

// Disable Gizmo
localStorage.removeItem('LEMONADE_DEV_GIZMO')

// Enable Scene Launcher
localStorage.setItem('LEMONADE_DEV_SCENE_LAUNCHER', '1')

// Disable Scene Launcher
localStorage.removeItem('LEMONADE_DEV_SCENE_LAUNCHER')
```

Flags persist across page refreshes until cleared.

---

## Troubleshooting

### Gizmo Issues

**"No object selected" - objects not clickable**
- Objects must have names in Three.js scene
- Make sure you're clicking on visible mesh geometry
- Check browser console for errors

**Changes not saving**
- Click the blue "💾 Save Transform" button after moving
- Check that button highlights when clicked

**Export not working**
- Browser may have popup blocker enabled
- Try "📋 Copy JSON" instead
- Check browser console for permission errors

### Scene Launcher Issues

**Preset buttons not responding**
- Refresh the page
- Check console for JavaScript errors
- Verify `enableSceneLauncher()` was run

**Scene doesn't change when preset clicked**
- Confirm Scene Launcher panel is visible (cyan border, bottom-right)
- Try a different preset
- Refresh page

**Custom scene not launching**
- Ensure all dropdowns/sliders have values
- "🎬 Launch Custom Scene" button should highlight when clicked
- Check browser console for errors

### Both Tools

**Panels not visible**
- Check console output for enable messages
- Verify localStorage flags are set
- Try refreshing page
- Check browser dev tools are not covering panels

**Performance issues**
- Disable gizmo when not needed (it adds raycasting overhead)
- Scene launcher has minimal impact
- Close other browser tabs

---

## References

- Three.js Docs: https://threejs.org/
- Raycasting: https://threejs.org/docs/#api/en/core/Raycaster
- Scene Code: `packages/scene/src/index.ts`
- App Code: `apps/web/src/app.ts`

---

## Advanced: Custom Selectable Objects

To limit gizmo selection to specific objects, edit the gizmo initialization:

```typescript
// In packages/scene/src/index.ts
if (options.enableGizmo) {
  gizmo = createGizmoController({
    camera,
    scene,
    container: canvas.parentElement || document.body,
    selectableObjects: [
      stand.root,
      ...signs.map(s => s.root),
      seller.person.root,
    ], // Only these can be selected
  });
}
```

---

**Last Updated**: September 22, 2026  
**Version**: 1.0

Both tools are active dev utilities and should be disabled in production.
