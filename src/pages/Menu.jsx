import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useHotel } from '../lib/hotel'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'

const emptyItem = { name: '', category_id: '', price: '', description: '', available: true }
const emptyCat = { name: '', sort_order: 0 }

export default function Menu() {
  const { hotelId, hotelLoading } = useHotel()
  const [tab, setTab] = useState('items')
  const [items, setItems] = useState([])
  const [cats, setCats] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [showItem, setShowItem] = useState(false)
  const [item, setItem] = useState(emptyItem)
  const [itemId, setItemId] = useState(null)

  const [showCat, setShowCat] = useState(false)
  const [cat, setCat] = useState(emptyCat)
  const [catId, setCatId] = useState(null)

  const load = useCallback(async () => {
    if (!hotelId) return
    setLoading(true)
    setError(null)
    try {
      const [itemRes, catRes] = await Promise.all([
        supabase
          .from('menu_items')
          .select('*')
          .eq('hotel_id', hotelId)
          .order('created_at', { ascending: true }),
        supabase
          .from('menu_categories')
          .select('*')
          .eq('hotel_id', hotelId)
          .order('sort_order'),
      ])
      if (itemRes.error) throw itemRes.error
      if (catRes.error) throw catRes.error
      setItems(itemRes.data)
      setCats(catRes.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [hotelId])

  useEffect(() => {
    load()
  }, [load])

  const catName = (id) => cats.find((c) => c.id === id)?.name || '—'

  const saveItem = async () => {
    try {
      const payload = {
        hotel_id: hotelId,
        name: item.name,
        category_id: item.category_id || null,
        price: Number(item.price || 0),
        description: item.description,
        available: item.available,
      }
      if (itemId) await supabase.from('menu_items').update(payload).eq('id', itemId)
      else await supabase.from('menu_items').insert(payload)
      setShowItem(false)
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  const toggleAvailable = async (it) => {
    await supabase.from('menu_items').update({ available: !it.available }).eq('id', it.id)
    load()
  }

  const removeItem = async (it) => {
    if (!window.confirm(`Delete "${it.name}"?`)) return
    await supabase.from('menu_items').delete().eq('id', it.id)
    load()
  }

  const saveCat = async () => {
    try {
      const payload = {
        hotel_id: hotelId,
        name: cat.name,
        sort_order: Number(cat.sort_order || 0),
      }
      if (catId) await supabase.from('menu_categories').update(payload).eq('id', catId)
      else await supabase.from('menu_categories').insert(payload)
      setShowCat(false)
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  const removeCat = async (c) => {
    if (!window.confirm(`Delete category "${c.name}"?`)) return
    await supabase.from('menu_categories').delete().eq('id', c.id)
    load()
  }

  if (hotelLoading) return <p className="text-muted">Loading hotel…</p>

  return (
    <div>
      <PageHeader
        title="Menu"
        subtitle="Manage restaurant menu categories and items."
        actions={
          tab === 'items' ? (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setItemId(null)
                setItem(emptyItem)
                setShowItem(true)
              }}
            >
              + New item
            </button>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setCatId(null)
                setCat(emptyCat)
                setShowCat(true)
              }}
            >
              + New category
            </button>
          )
        }
      />

      <ul className="nav nav-tabs mb-3">
        {['items', 'categories'].map((t) => (
          <li className="nav-item" key={t}>
            <button
              className={`nav-link ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'items' ? 'Items' : 'Categories'}
            </button>
          </li>
        ))}
      </ul>

      {loading && <p className="text-muted">Loading…</p>}
      {error && <p className="text-danger">Error: {error}</p>}

      {!loading && !error && tab === 'items' && (
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead>
              <tr>
                <th>Item</th>
                <th>Category</th>
                <th>Price</th>
                <th>Available</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td className="fw-semibold">{it.name}</td>
                  <td>{catName(it.category_id)}</td>
                  <td>₱{Number(it.price).toLocaleString()}</td>
                  <td>
                    <button
                      className={`btn btn-sm ${it.available ? 'btn-success' : 'btn-secondary'}`}
                      onClick={() => toggleAvailable(it)}
                    >
                      {it.available ? 'Available' : 'Sold out'}
                    </button>
                  </td>
                  <td className="text-end">
                    <button
                      className="btn btn-sm btn-outline-secondary me-1"
                      onClick={() => {
                        setItemId(it.id)
                        setItem(it)
                        setShowItem(true)
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => removeItem(it)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-muted text-center">
                    No menu items yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && tab === 'categories' && (
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead>
              <tr>
                <th>Name</th>
                <th>Order</th>
                <th>Items</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cats.map((c) => (
                <tr key={c.id}>
                  <td className="fw-semibold">{c.name}</td>
                  <td>{c.sort_order}</td>
                  <td>{items.filter((it) => it.category_id === c.id).length}</td>
                  <td className="text-end">
                    <button
                      className="btn btn-sm btn-outline-secondary me-1"
                      onClick={() => {
                        setCatId(c.id)
                        setCat(c)
                        setShowCat(true)
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => removeCat(c)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {cats.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-muted text-center">
                    No categories yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showItem && (
        <Modal
          title={itemId ? 'Edit item' : 'New item'}
          onClose={() => setShowItem(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowItem(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={saveItem}>
                Save
              </button>
            </>
          }
        >
          <div className="mb-3">
            <label className="form-label">Name</label>
            <input
              className="form-control"
              value={item.name}
              onChange={(e) => setItem({ ...item, name: e.target.value })}
            />
          </div>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label">Category</label>
              <select
                className="form-select"
                value={item.category_id}
                onChange={(e) => setItem({ ...item, category_id: e.target.value })}
              >
                <option value="">— None —</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label">Price (PHP)</label>
              <input
                type="number"
                className="form-control"
                value={item.price}
                onChange={(e) => setItem({ ...item, price: e.target.value })}
              />
            </div>
            <div className="col-12">
              <label className="form-label">Description</label>
              <textarea
                className="form-control"
                rows="2"
                value={item.description}
                onChange={(e) => setItem({ ...item, description: e.target.value })}
              />
            </div>
            <div className="col-12">
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="avail"
                  checked={item.available}
                  onChange={(e) => setItem({ ...item, available: e.target.checked })}
                />
                <label className="form-check-label" htmlFor="avail">
                  Available for ordering
                </label>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {showCat && (
        <Modal
          title={catId ? 'Edit category' : 'New category'}
          onClose={() => setShowCat(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowCat(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={saveCat}>
                Save
              </button>
            </>
          }
        >
          <div className="mb-3">
            <label className="form-label">Name</label>
            <input
              className="form-control"
              value={cat.name}
              onChange={(e) => setCat({ ...cat, name: e.target.value })}
            />
          </div>
          <div>
            <label className="form-label">Sort order</label>
            <input
              type="number"
              className="form-control"
              value={cat.sort_order}
              onChange={(e) => setCat({ ...cat, sort_order: e.target.value })}
            />
          </div>
        </Modal>
      )}
    </div>
  )
}
