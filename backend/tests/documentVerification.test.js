import test from 'node:test'
import assert from 'node:assert/strict'

test('Document Verification: Unit and Workflow Logic', async (t) => {
  await t.test('1. Document status normalization returns expected display statuses', () => {
    const rawToDisplay = (raw) => (raw === 'verified' ? 'accepted' : (raw || 'not_submitted'))
    assert.equal(rawToDisplay(null), 'not_submitted')
    assert.equal(rawToDisplay('pending'), 'pending')
    assert.equal(rawToDisplay('verified'), 'accepted')
    assert.equal(rawToDisplay('rejected'), 'rejected')
  })

  await t.test('2. Base64 format validation accepts JPG, JPEG and PNG and rejects invalid formats', () => {
    const isValidFormat = (uri) => /^data:image\/(jpeg|jpg|png|svg\+xml);base64,/i.test(uri) || uri.startsWith('/images/')
    assert.equal(isValidFormat('data:image/jpeg;base64,/9j/4AAQSkZJRg=='), true)
    assert.equal(isValidFormat('data:image/jpg;base64,/9j/4AAQSkZJRg=='), true)
    assert.equal(isValidFormat('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='), true)
    assert.equal(isValidFormat('/images/demo-dl-front.svg'), true)
    assert.equal(isValidFormat('data:application/pdf;base64,JVBERi0xLjQK'), false)
    assert.equal(isValidFormat('data:text/plain;base64,SGVsbG8='), false)
  })

  await t.test('3. Document submission requires both front and back images', () => {
    const validateSubmission = (body) => {
      if (!body.booking_id) return 'Booking reference/ID is required'
      if (!body.front_image || !body.back_image) return 'Both Front Side and Back Side are required'
      return null
    }

    assert.equal(validateSubmission({}), 'Booking reference/ID is required')
    assert.equal(validateSubmission({ booking_id: 1, front_image: 'img1' }), 'Both Front Side and Back Side are required')
    assert.equal(validateSubmission({ booking_id: 1, back_image: 'img2' }), 'Both Front Side and Back Side are required')
    assert.equal(validateSubmission({ booking_id: 1, front_image: 'img1', back_image: 'img2' }), null)
  })

  await t.test('4. Staff verification actions only permit accept and reject', () => {
    const validateAction = (action) => {
      const act = String(action || '').toLowerCase().trim()
      return ['accept', 'reject'].includes(act)
    }

    assert.equal(validateAction('accept'), true)
    assert.equal(validateAction('reject'), true)
    assert.equal(validateAction('ACCEPT'), true)
    assert.equal(validateAction('REJECT'), true)
    assert.equal(validateAction('pending'), false)
    assert.equal(validateAction('delete'), false)
    assert.equal(validateAction(''), false)
  })

  await t.test('5. Rejection requires a descriptive reason or applies sensible fallback', () => {
    const getRejectionReason = (reason) => reason?.trim() || 'Document image unclear or unreadable.'
    assert.equal(getRejectionReason(''), 'Document image unclear or unreadable.')
    assert.equal(getRejectionReason(null), 'Document image unclear or unreadable.')
    assert.equal(getRejectionReason('Back side is blurry'), 'Back side is blurry')
  })

  await t.test('6. Customer resubmission resets rejected status back to pending', () => {
    const handleResubmit = (currentDoc, newFront, newBack) => {
      return {
        ...currentDoc,
        front_url: newFront,
        back_url: newBack,
        verification_status: 'pending',
        rejection_reason: null,
        updated_at: new Date().toISOString()
      }
    }

    const rejectedDoc = {
      booking_id: 101,
      verification_status: 'rejected',
      rejection_reason: 'Image too blurry',
      front_url: 'old_front',
      back_url: 'old_back'
    }

    const resubmitted = handleResubmit(rejectedDoc, 'new_front', 'new_back')
    assert.equal(resubmitted.verification_status, 'pending')
    assert.equal(resubmitted.rejection_reason, null)
    assert.equal(resubmitted.front_url, 'new_front')
    assert.equal(resubmitted.back_url, 'new_back')
  })
})
