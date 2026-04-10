/**
 * Canvas-based map renderer.
 * Renders terrain grid, cities (colored by league), trade routes, and utility bars.
 * Handles click/drag interactions for opening panels.
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { TERRAIN_COLORS } from '../utils/terrain';
import { getCityUtility } from '../models/Game';

const CELL_SIZE = 20;
const CITY_RADIUS = 8;

const LEAGUE_COLORS = ['#8b2500', '#2e6b8a', '#3a7d44', '#b8860b'];

export default function MapView({ game, onCityClick, onCityDrag, selectedCityId, onHoverCity }) {
  const canvasRef = useRef(null);
  const [dragState, setDragState] = useState(null);
  const [hoveredCity, setHoveredCity] = useState(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState(null);

  const { map, cities, trades, leagues } = game;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(offset.x, offset.y);

    // Draw terrain
    for (let r = 0; r < map.height; r++) {
      for (let c = 0; c < map.width; c++) {
        const terrain = map.grid[r][c];
        ctx.fillStyle = TERRAIN_COLORS[terrain] || '#333';
        ctx.fillRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }

    // Draw grid lines (subtle)
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 0.5;
    for (let r = 0; r <= map.height; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * CELL_SIZE);
      ctx.lineTo(map.width * CELL_SIZE, r * CELL_SIZE);
      ctx.stroke();
    }
    for (let c = 0; c <= map.width; c++) {
      ctx.beginPath();
      ctx.moveTo(c * CELL_SIZE, 0);
      ctx.lineTo(c * CELL_SIZE, map.height * CELL_SIZE);
      ctx.stroke();
    }

    // Draw trade routes
    for (const trade of trades) {
      const from = cities[trade.fromCityId];
      const to = cities[trade.toCityId];
      const fx = from.col * CELL_SIZE + CELL_SIZE / 2;
      const fy = from.row * CELL_SIZE + CELL_SIZE / 2;
      const tx = to.col * CELL_SIZE + CELL_SIZE / 2;
      const ty = to.row * CELL_SIZE + CELL_SIZE / 2;

      // Line thickness based on trade volume
      let volume = 0;
      for (const g of Object.values(trade.goods)) volume += Math.abs(g);
      const thickness = Math.max(1, Math.min(5, volume / 3));

      ctx.strokeStyle = 'rgba(139, 105, 20, 0.7)';
      ctx.lineWidth = thickness;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw drag line
    if (dragState) {
      ctx.strokeStyle = 'rgba(139, 37, 0, 0.6)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.beginPath();
      ctx.moveTo(dragState.startX, dragState.startY);
      ctx.lineTo(dragState.currentX - offset.x, dragState.currentY - offset.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw cities
    for (const city of cities) {
      const cx = city.col * CELL_SIZE + CELL_SIZE / 2;
      const cy = city.row * CELL_SIZE + CELL_SIZE / 2;

      // City circle
      const isSelected = city.id === selectedCityId;
      const leagueColor = city.leagueId !== null
        ? (leagues[city.leagueId]?.color || LEAGUE_COLORS[city.leagueId % LEAGUE_COLORS.length])
        : '#ffffff';

      // Glow for selected
      if (isSelected) {
        ctx.shadowColor = '#8b6914';
        ctx.shadowBlur = 10;
      }

      ctx.fillStyle = leagueColor;
      ctx.strokeStyle = isSelected ? '#8b6914' : '#3a2f20';
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, CITY_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.shadowBlur = 0;

      // City name
      ctx.fillStyle = '#1a120a';
      ctx.strokeStyle = 'rgba(245, 240, 232, 0.85)';
      ctx.lineWidth = 3;
      ctx.font = "11px 'Source Serif 4', Georgia, serif";
      ctx.textAlign = 'center';
      ctx.strokeText(city.name, cx, cy - CITY_RADIUS - 4);
      ctx.fillText(city.name, cx, cy - CITY_RADIUS - 4);

      // Utility bar under city
      const utility = getCityUtility(city);
      const autarchy = city.autarchyUtility;
      const barWidth = 30;
      const barHeight = 4;
      const barX = cx - barWidth / 2;
      const barY = cy + CITY_RADIUS + 3;

      // Background
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(barX, barY, barWidth, barHeight);

      // Autarchy reference line
      const normalizedAutarchy = 0.5; // autarchy is always the midpoint
      const normalizedUtility = Math.max(0, Math.min(1,
        utility >= autarchy
          ? 0.5 + (utility - autarchy) / (Math.abs(autarchy) * 2) * 0.5
          : 0.5 * (utility / autarchy)
      ));

      // Utility fill
      ctx.fillStyle = utility >= autarchy ? '#3a7d44' : '#8b2500';
      ctx.fillRect(barX, barY, barWidth * normalizedUtility, barHeight);

      // Autarchy line
      ctx.strokeStyle = '#1a120a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(barX + barWidth * normalizedAutarchy, barY);
      ctx.lineTo(barX + barWidth * normalizedAutarchy, barY + barHeight);
      ctx.stroke();
    }

    ctx.restore();
  }, [map, cities, trades, leagues, selectedCityId, dragState, offset]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Resize canvas to fit container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement;
    const resize = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [draw]);

  const findCityAt = useCallback((x, y) => {
    const mx = x - offset.x;
    const my = y - offset.y;
    for (const city of cities) {
      const cx = city.col * CELL_SIZE + CELL_SIZE / 2;
      const cy = city.row * CELL_SIZE + CELL_SIZE / 2;
      const dist = Math.sqrt((mx - cx) ** 2 + (my - cy) ** 2);
      if (dist <= CITY_RADIUS + 4) return city;
    }
    return null;
  }, [cities, offset]);

  const handleMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const city = findCityAt(x, y);

    if (city) {
      setDragState({
        startCity: city,
        startX: city.col * CELL_SIZE + CELL_SIZE / 2,
        startY: city.row * CELL_SIZE + CELL_SIZE / 2,
        currentX: x,
        currentY: y,
      });
    } else {
      setIsPanning(true);
      setPanStart({ x: x - offset.x, y: y - offset.y });
    }
  };

  const handleMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isPanning && panStart) {
      setOffset({ x: x - panStart.x, y: y - panStart.y });
      return;
    }

    if (dragState) {
      setDragState(prev => ({ ...prev, currentX: x, currentY: y }));
      return;
    }

    const city = findCityAt(x, y);
    if (city !== hoveredCity) {
      setHoveredCity(city);
      onHoverCity?.(city);
    }
  };

  const handleMouseUp = (e) => {
    if (isPanning) {
      setIsPanning(false);
      setPanStart(null);
      return;
    }

    if (dragState) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const endCity = findCityAt(x, y);

      if (endCity && endCity.id !== dragState.startCity.id) {
        // Dragged from one city to another
        onCityDrag?.(dragState.startCity, endCity);
      } else if (!endCity || endCity.id === dragState.startCity.id) {
        // Clicked on a city (no drag or dragged back to same)
        onCityClick?.(dragState.startCity);
      }

      setDragState(null);
      return;
    }
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', cursor: isPanning ? 'grabbing' : (hoveredCity ? 'pointer' : 'grab') }}>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setDragState(null); setIsPanning(false); }}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
      {hoveredCity && !dragState && (
        <div style={{
          position: 'absolute',
          left: (hoveredCity.col * CELL_SIZE + CELL_SIZE / 2 + offset.x) + 15,
          top: (hoveredCity.row * CELL_SIZE + CELL_SIZE / 2 + offset.y) - 10,
          background: 'rgba(250, 248, 243, 0.96)',
          color: '#2c2418',
          padding: '8px 12px',
          borderRadius: 5,
          border: '1px solid #d4c9b5',
          boxShadow: '0 3px 10px rgba(0,0,0,0.12)',
          fontSize: 12,
          fontFamily: "'Source Serif 4', Georgia, serif",
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          zIndex: 10,
        }}>
          <strong>{hoveredCity.name}</strong>
          <br />
          Pop: {hoveredCity.population} | League: {hoveredCity.leagueId !== null ? game.leagues[hoveredCity.leagueId].name : 'None'}
          <br />
          Utility: {getCityUtility(hoveredCity).toFixed(2)} | Autarchy: {hoveredCity.autarchyUtility.toFixed(2)}
          <br />
          Costs: W:{hoveredCity.productionCosts.wheat} F:{hoveredCity.productionCosts.fish} I:{hoveredCity.productionCosts.iron} S:{hoveredCity.productionCosts.silk}
        </div>
      )}
    </div>
  );
}
