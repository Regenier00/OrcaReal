import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createUserCompany } from '@/features/company/companyService'
import { lookupCnpj } from '@/features/company/cnpjLookup'
import {
  cnpjValidationMessage,
  formatCnpj,
  isValidCnpj,
  onlyDigits,
} from '@/features/company/cnpj'
import { markCompanyOnboardingInProgress } from '@/features/company/onboardingFlag'
import {
  SEGMENT_OPTIONS,
  isOtherSegment,
  type SegmentCode,
} from '@/features/company/segmentOptions'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'

export function CreateCompanyPage() {
  const navigate = useNavigate()
  const submittingRef = useRef(false)

  const [name, setName] = useState('')
  const [document, setDocument] = useState('')
  const [segmentCode, setSegmentCode] = useState<SegmentCode | ''>('')
  const [customSegment, setCustomSegment] = useState('')
  const [description, setDescription] = useState('')
  const [lookupHint, setLookupHint] = useState('')
  const [lookupError, setLookupError] = useState('')
  const [lookingUp, setLookingUp] = useState(false)

  const [nameError, setNameError] = useState('')
  const [documentError, setDocumentError] = useState('')
  const [segmentError, setSegmentError] = useState('')
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const digits = onlyDigits(document)
    if (digits.length !== 14 || !isValidCnpj(digits)) {
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setLookingUp(true)
      setLookupError('')
      setLookupHint('Consultando CNPJ...')

      void lookupCnpj(digits, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return
          if (result.legalName) setName(result.legalName)
          if (result.description) setDescription(result.description)
          if (result.suggestedSegment) setSegmentCode(result.suggestedSegment)
          const statusNote = result.status
            ? `Situação: ${result.status}.`
            : ''
          setLookupHint(
            `Dados preenchidos a partir do CNPJ. ${statusNote} Você pode ajustar o que precisar.`
          )
          setLookupError('')
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return
          const aborted =
            (error instanceof DOMException && error.name === 'AbortError') ||
            (error instanceof Error && error.name === 'AbortError')
          const message =
            error instanceof Error && error.message === 'CNPJ_NOT_FOUND'
              ? 'CNPJ não encontrado na Receita Federal. Você pode continuar preenchendo manualmente.'
              : aborted
                ? ''
                : 'Não foi possível consultar o CNPJ agora. Continue o cadastro manualmente.'
          if (message) {
            setLookupHint('')
            setLookupError(message)
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLookingUp(false)
        })
    }, 400)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [document])

  const handleDocumentChange = (value: string) => {
    const formatted = formatCnpj(value)
    setDocument(formatted)
    setDocumentError(cnpjValidationMessage(formatted) ?? '')
    if (onlyDigits(formatted).length < 14) {
      setLookupHint('')
      setLookupError('')
    }
  }

  const validate = () => {
    const trimmedName = name.trim()
    const nextNameError = trimmedName ? '' : 'Informe o nome da empresa.'
    const nextSegmentError = segmentCode
      ? ''
      : 'Selecione o tipo de empresa ou segmento.'
    const nextDocumentError = cnpjValidationMessage(document) ?? ''

    setNameError(nextNameError)
    setSegmentError(nextSegmentError)
    setDocumentError(nextDocumentError)

    return !nextNameError && !nextSegmentError && !nextDocumentError
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submittingRef.current || loading) return
    setFormError('')

    if (!validate()) return

    submittingRef.current = true
    setLoading(true)

    const result = await createUserCompany({
      name,
      document,
      description,
      segmentCode: segmentCode as SegmentCode,
      customSegment: isOtherSegment(segmentCode) ? customSegment : '',
    })

    if (!result.ok) {
      submittingRef.current = false
      setLoading(false)
      setFormError(result.message)
      return
    }

    markCompanyOnboardingInProgress()
    navigate('/app/empresa-criada', {
      replace: true,
      state: {
        companyCreated: true,
        companyName: result.data.trade_name || result.data.name,
      },
    })
  }

  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-mist">
        Primeiros passos
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">
        Vamos configurar sua empresa
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mist sm:text-base">
        Cadastre as informações básicas da sua empresa para começar a utilizar o
        OrcaReal.
      </p>

      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="mt-8 flex flex-col gap-4 rounded-2xl border border-paper-muted bg-white p-5 sm:p-7"
      >
        <h2 className="font-display text-xl font-semibold text-navy">
          Informações da empresa
        </h2>

        <Input
          label="Nome da empresa"
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            if (event.target.value.trim()) setNameError('')
          }}
          error={nameError}
          required
          autoComplete="organization"
        />

        <Input
          label="CNPJ"
          value={document}
          onChange={(event) => handleDocumentChange(event.target.value)}
          error={documentError}
          hint={
            lookingUp && onlyDigits(document).length === 14
              ? 'Consultando CNPJ...'
              : lookupHint || undefined
          }
          placeholder="00.000.000/0000-00"
          inputMode="numeric"
        />
        {lookupError ? <p className="text-xs text-mist">{lookupError}</p> : null}

        <Select
          label="Tipo de empresa / segmento"
          value={segmentCode}
          onChange={(event) => {
            setSegmentCode(event.target.value as SegmentCode | '')
            setSegmentError('')
          }}
          error={segmentError}
          required
        >
          <option value="">Selecione o segmento</option>
          {SEGMENT_OPTIONS.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label}
            </option>
          ))}
        </Select>

        {isOtherSegment(segmentCode) ? (
          <Input
            label="Informe o segmento"
            value={customSegment}
            onChange={(event) => setCustomSegment(event.target.value)}
            placeholder="Descreva o ramo da empresa"
          />
        ) : null}

        <Textarea
          label="Descrição"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          hint="Opcional"
          placeholder="Resumo da atividade da empresa"
        />

        {formError ? <p className="text-sm text-danger">{formError}</p> : null}

        <Button type="submit" disabled={loading} className="mt-2 w-full sm:w-auto">
          {loading ? 'Criando empresa...' : 'Criar empresa'}
        </Button>
      </form>
    </div>
  )
}
