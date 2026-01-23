import { render, screen } from '@testing-library/react'
 
// Example test, please write your own tests
describe('Example', () => {
  it('should render a heading', () => {
    render(<h1>Test</h1>)
 
    const heading = screen.getByRole('heading', {
      name: /Test/i,
    })
 
    expect(heading).toBeInTheDocument()
  })
})
