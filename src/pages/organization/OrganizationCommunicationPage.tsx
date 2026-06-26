import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { Clock3, Plus, Trash2, Users } from 'lucide-react'
import { useOrgCommunicationTemplate, type CalendarEvent } from '@/hooks/usePrepareTemplateState'

const days: CalendarEvent['day'][] = ['seg', 'ter', 'qua', 'qui', 'sex']
const dayLabels: Record<CalendarEvent['day'], string> = { seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui', sex: 'Sex' }
const types: CalendarEvent['type'][] = ['diario', 'semanal', 'quinzenal', 'mensal']
const audiences: CalendarEvent['audience'][] = ['gerentes', 'lideres', 'consultores']
const colors = ['#3B4FE8', '#F59E0B', '#10b981', '#8b5cf6', '#ec4899']
const slots = Array.from({ length: 21 }, (_, index) => {
  const minutes = 8 * 60 + index * 30
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
})

export default function OrganizationCommunicationPage() {
  const { projectId } = useParams()
  const [events, setEvents] = useOrgCommunicationTemplate(projectId)
  const [draft, setDraft] = useState<Omit<CalendarEvent, 'id'>>({
    title: '',
    day: 'seg',
    start_time: '09:00',
    duration: 30,
    type: 'semanal',
    audience: 'gerentes',
    color: colors[0],
  })

  const stats = useMemo(() => ({
    total: events.length,
    weekly: events.filter((event) => event.type === 'semanal').length,
    managers: events.filter((event) => event.audience === 'gerentes').length,
    minutes: events.reduce((sum, event) => sum + Number(event.duration), 0),
  }), [events])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setEvents((current) => [...current, { ...draft, id: `event-${Date.now()}` }])
    setDraft((current) => ({ ...current, title: '' }))
  }

  function updateEvent(id: string, input: Partial<CalendarEvent>) {
    setEvents((current) => current.map((event) => event.id === id ? { ...event, ...input } : event))
  }

  function removeEvent(id: string) {
    setEvents((current) => current.filter((event) => event.id !== id))
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <span className="badge badge-blue">Fase 1 - Prepare</span>
          <h1 className="mt-3 text-2xl font-bold text-text-primary">Organização e Comunicação</h1>
          <p className="mt-1 text-sm text-text-secondary">Rituais, stakeholders, canais e cadência de comunicação do projeto.</p>
        </div>
        <span className="badge badge-green">Grade 08:00-18:00</span>
      </header>

      <section className="mb-5 grid gap-4 md:grid-cols-4">
        <Kpi label="Eventos" value={stats.total} />
        <Kpi label="Semanais" value={stats.weekly} />
        <Kpi label="Gerenciais" value={stats.managers} />
        <Kpi label="Carga semanal" value={`${Math.round(stats.minutes / 60)}h`} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <aside className="space-y-5">
          <form className="card" onSubmit={submit}>
            <div className="mb-4 flex items-center gap-3">
              <span className="rounded-[8px] bg-[#0f1229] p-2 text-brand-600"><Plus className="h-5 w-5" /></span>
              <h2 className="text-lg font-bold text-text-primary">Novo rito</h2>
            </div>
            <div className="grid gap-4">
              <Input label="Título" value={draft.title} onChange={(title) => setDraft((d) => ({ ...d, title }))} />
              <div className="grid grid-cols-2 gap-3">
                <Select label="Dia" value={draft.day} options={days} onChange={(day) => setDraft((d) => ({ ...d, day: day as CalendarEvent['day'] }))} />
                <Select label="Horário" value={draft.start_time} options={slots} onChange={(start_time) => setDraft((d) => ({ ...d, start_time }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Duração" value={String(draft.duration)} options={['30', '60', '90', '120']} onChange={(duration) => setDraft((d) => ({ ...d, duration: Number(duration) }))} />
                <Select label="Recorrência" value={draft.type} options={types} onChange={(type) => setDraft((d) => ({ ...d, type: type as CalendarEvent['type'] }))} />
              </div>
              <Select label="Público" value={draft.audience} options={audiences} onChange={(audience) => setDraft((d) => ({ ...d, audience: audience as CalendarEvent['audience'] }))} />
              <div>
                <span className="label">Cor</span>
                <div className="flex gap-2">
                  {colors.map((color) => (
                    <button key={color} className={`h-8 w-8 rounded-[8px] border ${draft.color === color ? 'border-white' : 'border-surface-border'}`} style={{ background: color }} type="button" onClick={() => setDraft((d) => ({ ...d, color }))} />
                  ))}
                </div>
              </div>
              <button className="btn-primary" type="submit"><Plus className="h-4 w-4" /> Adicionar</button>
            </div>
          </form>

          <section className="card2">
            <h2 className="mb-3 text-lg font-bold text-text-primary">Legenda</h2>
            <div className="space-y-2 text-sm text-text-secondary">
              {types.map((type) => <div key={type} className="flex items-center justify-between"><span>{type}</span><span className="badge badge-gray">recorrência</span></div>)}
            </div>
          </section>
        </aside>

        <section className="card overflow-hidden">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-text-primary">Calendário Semanal</h2>
              <p className="text-sm text-text-secondary">Edite dia, horário e duração nos controles abaixo de cada evento.</p>
            </div>
            <span className="badge badge-blue"><Clock3 className="h-3.5 w-3.5" /> Slots de 30min</span>
          </div>

          <div className="overflow-x-auto">
            <div className="grid min-w-[920px] grid-cols-[80px_repeat(5,minmax(0,1fr))] gap-px rounded-[8px] border border-surface-border bg-surface-border text-xs">
              <div className="bg-[#0f1229] p-3 font-bold text-text-secondary">Hora</div>
              {days.map((day) => <div key={day} className="bg-[#0f1229] p-3 text-center font-bold text-text-primary">{dayLabels[day]}</div>)}
              {slots.map((slot) => (
                <GridRow key={slot} slot={slot} events={events.filter((event) => event.start_time === slot)} onUpdate={updateEvent} onRemove={removeEvent} />
              ))}
            </div>
          </div>
        </section>
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-3">
        <InfoCard icon={<Users className="h-4 w-4" />} title="Stakeholders" text="Sponsor, GP, líderes funcionais, consultores e key-users." />
        <InfoCard icon={<Clock3 className="h-4 w-4" />} title="Canais" text="Teams, e-mail executivo, backlog de decisões e status report semanal." />
        <InfoCard icon={<Plus className="h-4 w-4" />} title="Governança" text="Eventos sustentam escalonamento, decisões e preparação dos gates." />
      </section>
    </div>
  )
}

function GridRow({ slot, events, onUpdate, onRemove }: { slot: string; events: CalendarEvent[]; onUpdate: (id: string, input: Partial<CalendarEvent>) => void; onRemove: (id: string) => void }) {
  return (
    <>
      <div className="bg-[#0f1229] p-2 text-center text-text-muted">{slot}</div>
      {days.map((day) => {
        const cellEvents = events.filter((event) => event.day === day)
        return (
          <div key={`${slot}-${day}`} className="min-h-[74px] bg-[#11152d] p-1">
            {cellEvents.map((event) => (
              <div key={event.id} className="rounded-[8px] border border-surface-border p-2 text-white shadow-sm" style={{ background: event.color }}>
                <div className="flex items-start justify-between gap-2">
                  <strong className="text-xs">{event.title}</strong>
                  <button className="opacity-80 hover:opacity-100" type="button" onClick={() => onRemove(event.id)}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
                <p className="mt-1 text-[11px] opacity-90">{event.duration}min - {event.type} - {event.audience}</p>
                <div className="mt-2 grid grid-cols-2 gap-1">
                  <select className="rounded-[6px] bg-white/15 px-1 py-1 text-[11px]" value={event.day} onChange={(e) => onUpdate(event.id, { day: e.target.value as CalendarEvent['day'] })}>{days.map((item) => <option key={item} value={item}>{dayLabels[item]}</option>)}</select>
                  <select className="rounded-[6px] bg-white/15 px-1 py-1 text-[11px]" value={event.start_time} onChange={(e) => onUpdate(event.id, { start_time: e.target.value })}>{slots.map((item) => <option key={item} value={item}>{item}</option>)}</select>
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </>
  )
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return <div className="card2"><span className="text-sm text-text-secondary">{label}</span><strong className="mt-2 block text-2xl text-text-primary">{value}</strong></div>
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label><span className="label">{label}</span><input className="input" required value={value} onChange={(event) => onChange(event.target.value)} /></label>
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label><span className="label">{label}</span><select className="input" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
}

function InfoCard({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return <div className="card2"><span className="mb-3 inline-flex rounded-[8px] bg-[#0f1229] p-2 text-brand-600">{icon}</span><h2 className="font-bold text-text-primary">{title}</h2><p className="mt-1 text-sm text-text-secondary">{text}</p></div>
}
