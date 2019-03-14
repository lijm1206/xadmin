import React from 'react'
import PropTypes from 'prop-types'
import _ from 'lodash'
import { Checkbox, FormControl } from 'react-bootstrap'

import app, { api, Block, StoreWrap } from 'xadmin'
import { FormWrap } from 'xadmin-form'
import Icon from 'react-fontawesome'

import ModelPages from './components/Pages'
import { Model, ModelWrap } from './base'

import Select from 'react-select'
import AsyncSelect from 'react-select/lib/Async'

@FormWrap('model.form.relates')
class Checkboxes extends React.Component {

  componentDidMount() {
    const { input, options, field } = this.props
    if(!options) {
      this.props.getRelatedItems()
    }
  }

  onChange(checked, option) {
    const { input: { value, onChange } } = this.props
    if(checked) {
      onChange([ ...value, option ])
    } else {
      onChange(value.filter(item => item.id != option.id))
    }
  }

  renderOptions() {
    const { input, options, field } = this.props
    const displayField = field.displayField || 'name'
    const checkedIds = input.value ? input.value.map(item => item.id) : []
    return options.map(option=>{
      const checked = checkedIds.indexOf(option.id) >= 0
      return <Checkbox onChange={()=>{this.onChange(!checked, option)}} checked={checked} {...field.attrs} >{option[displayField]}</Checkbox>
    })
  }

  render() {
    const { _t } = app.context
    const { input, options, label, meta, field, group: FieldGroup } = this.props
    const { items } = field
    return (
      <FieldGroup label={label} meta={meta} input={input} field={field}>
        {options?this.renderOptions():<div>{_t('loading')}</div>}
      </FieldGroup>
    )
  }

}

@FormWrap('model.form.relates')
class RelateMultiSelect extends React.Component {

  componentDidMount() {
    const { input, options, field } = this.props
    if(options == null) {
      this.props.getRelatedItems()
    }
  }

  onChange(checked, option) {
    const { input: { value, onChange } } = this.props
    if(checked) {
      onChange([ ...value, option ])
    } else {
      onChange(value.filter(item => item.id != option.id))
    }
  }

  onValuesChange(selectOptions) {
    const { input: { value, onChange }, options } = this.props
    onChange(selectOptions.map(option=>{ return option.item }))
  }

  renderOptions() {
    const { _t } = app.context
    const { input, options, field } = this.props
    const displayField = field.displayField || 'name'
    const checkedValues = input.value ? input.value.map(item => { return { label: item[displayField] || 'null', value: item.id, item }}) : []
    return (<Select multi={true} theme="bootstrap3" ref = "select"
      placeholder={_t('Select {{label}}', { label: field.label })}
      values={checkedValues}
      options={options.map(option=>{ return { label: option[displayField] || 'null', value: option.id, item: option } })}
      onChange={this.onValuesChange.bind(this)}
      renderNoResultsFound={()=>{ return (<div className="no-results-found">{_t('No results found')}</div>)}}
      {...field.attrs}
    />)
  }

  render() {
    const { _t } = app.context
    const { input, options, loading, label, meta, field, group: FieldGroup } = this.props
    const { items } = field
    return (
      <FieldGroup label={label} meta={meta} input={input} field={field}>
        {(!loading && options)?this.renderOptions():<FormControl.Static>{_t('loading')}</FormControl.Static>}
      </FieldGroup>
    )
  }

}

//@FormWrap('model.form.fkselect')
class RelateSelect extends React.Component {

  loadOptions = inputValue => {
    const { input: { value }, label, meta, field, group: FieldGroup } = this.props
    const displayField = field.displayField || 'name'
    return api(field.schema)
      .query({ limit: 1000, fields: [ 'id', displayField ] }, { search: { [displayField]: { like: inputValue } } })
      .then(({ items }) => 
        items.map(item => 
          ({ value: item, label: item[displayField] })
        )
      )
  }

  onChange = (value) => {
    this.props.input.onChange(value.value)
  }

  render() {
    const { _t } = app.context
    const { input: { value }, label, meta, field, group: FieldGroup } = this.props
    const displayField = field.displayField || 'name'
    return (
      <FieldGroup label={label} meta={meta} input={this.props.input} field={field}>
        <AsyncSelect cacheOptions defaultOptions 
          selectOption={value ? { value, label: value[displayField] } : null} 
          onChange={this.onChange} 
          loadOptions={this.loadOptions} 
        />
      </FieldGroup>
    )
  }

}

const schema_converter = [
  (f, schema, options) => {
    if(schema.type == 'array' && schema.items.type == 'object' && schema.items.name) {
      const models = app.get('models')
      const name = schema.items.name
      if(models[name]) {
        const model = models[name]
        f.type = 'relates'
        f.schema = model
        f.displayField = model.display_field || 'name'
      }
    }
    return f
  },
  (f, schema, options) => {
    if(schema.type == 'object' && schema.relateTo) {
      const models = app.get('models')
      const relateName = schema.relateTo
      if(models[relateName]) {
        const model = models[relateName]
        f.type = 'fkselect'
        f.schema = model
        f.displayField = model.display_field || 'name'
      }
    }
    return f
  }
]

const filter_converter = [
  (f, schema, options) => {
    if(schema.type == 'object' && schema.name) {
      const models = app.load_dict('models')
      const relateName = schema.relateTo || schema.name
      if(models[relateName]) {
        const model = models[relateName]
        f.type = 'filter_relate'
        f.schema = model
        f.displayField = model.display_field || 'name'
      }
    }
    return f
  } ]

const FilterRelateSelect = FormWrap('model.form.fkselect')(({ input, options, ...props }) => {
  const value = options && _.find(options, item => item.id == input.value) || input.value
  const newProps = { ...props, options, input: { ...input, value,
    onChange: (value) => {
      input.onChange(value ? value.id : null)
    } } }
  return <RelateSelect.WrappedComponent {...newProps} />
})

const form_fields = {
  relates: {
    component: RelateMultiSelect
  },
  fkselect: {
    component: RelateSelect
  },
  filter_relate: {
    component: FilterRelateSelect,
    parse: (value, name) => {
      if(value && value.id) {
        return value.id
      }
      return value
    }
  }
}

const mappers = {
  'model.form.relates': {
    data: ({ state, form, formState }, { input: { value }, field }) => {
      const data = {}
      if(formState) {
        data['options'] = formState.relates ? _.get(formState.relates, field.name) : null
      }
      const key = `form.${form.formKey}.${field.name}.relates`
      if(state.loading[key]) {
        data['loading'] = true
      }
      return data
    },
    method: {
      getRelatedItems: ({ dispatch, form }, { field }) => () => {
        dispatch({ type: 'GET_RELATED_ITEMS', meta: { form: form.formKey, field, model: field.items.schema } })
      }
    }
  },
  'model.form.fkselect': {
    data: ({ state, form, formState, dispatch }, { input: { value }, field }) => {
      const key = `form.${form.formKey}.${field.name}.relates`
      return {
        options: (formState && formState.relates) ? _.get(formState.relates, field.name) : [],
        values: formState && formState.values,
        loading: state.loading[key]
      }
    },
    method: {
      getValue: ({ state, form, formState, dispatch }, { field }) => (value) => {
        dispatch({ 
          type: 'GET_RELATED_ITEM', 
          meta: { form: form.formKey, field, model: field.schema }, 
          id: value 
        })
      },
      searchRelatedItems: ({ dispatch, form, formState }, { field }) => (search) => {
        if(search === '') {
          dispatch({ 
            type: 'GET_RELATED_ITEMS', 
            meta: { form: form.formKey, field, model: field.schema },
            items: [], success: true
          })
          return
        }

        const searchField = field.searchField || field.displayField || 'name'
        const wheres = search ? { search: { [searchField]: { like: search } } } : {}

        if(formState && field.limit) {
          const limit = field.limit(formState.values)
          if(limit == null) {
            dispatch({
              type: 'GET_RELATED_ITEMS',
              meta: { form: form.formKey, field, model: field.schema },
              success: true, items: []
            })
            return 
          } else {
            wheres['limit'] = limit
          }
        }

        dispatch({ 
          type: 'GET_RELATED_ITEMS', 
          meta: { form: form.formKey, field, model: field.schema },
          wheres: { ...wheres }
        })
      }
    }
  }
}

const reducers = {
  form: (state={}, action) => {
    if(action.type == 'GET_RELATED_ITEMS' && action.success) {
      const { meta: { form, field, model }, items } = action
      return { ..._.set(state, `${form}.relates.${field.name}`, items) }
    }
    if(action.type == 'GET_RELATED_ITEM' && action.success) {
      const { meta: { form, field, model } } = action
      let item = action.item
      if(field.parse) {
        item = field.parse(item, field.name)
      }
      let newState = _.set(state, `${form}.values.${field.name}`, item)

      // if relates is empty push into
      const relates = _.get(newState, `${form}.relates.${field.name}`)
      if(!relates || relates.length == 0) {
        newState = _.set(newState, `${form}.relates.${field.name}`, [ action.item ])
      }
      
      return { ...newState }
    }
    return state
  }
}

class RelateObjectCls extends React.Component {

  getChildContext() {
    return { relateObj: this.props.data, relateModel: this.context.model }
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.id !== nextProps.id) {
      this.props.getItem(nextProps.id)
    }
  }

  render() {
    const { _t } = app.context
    const { data, loading, model } = this.props
    const displayField = model.display_field || 'name'
    return loading || data == undefined ? 
      (<div className="text-center"><Icon name="spinner fa-spin fa-4x"/> {_t('loading')}</div>) : 
      (
        <div>
          <h4><Icon name={model.icon} /> {data[displayField]}</h4>
          <hr/>
          {this.props.children}
        </div>
      )
  }

}

RelateObjectCls.propTypes = {
  id: PropTypes.string,
  data: PropTypes.object,
  loading: PropTypes.bool.isRequired,
  model: PropTypes.object.isRequired,
  getItem: PropTypes.func.isRequired
}

RelateObjectCls.contextTypes = {
  model: PropTypes.object.isRequired
}

RelateObjectCls.childContextTypes = {
  relateObj: PropTypes.object.isRequired,
  relateModel: PropTypes.object.isRequired
}

const RelateObject = ModelWrap('model.item')(RelateObjectCls)

const RelateWrap = (SubComponent) => {

  class RelateWrap extends React.Component {

    render() {
      const { location, ...props } = this.props
      const { relateObj, relateModel } = this.context

      return <SubComponent {...props} location={{ ...location, query: {  ...location.query, [relateModel.name]: relateObj.id } }} />
    }
  }
  
  RelateWrap.contextTypes = {
    relateObj: PropTypes.object.isRequired,
    relateModel: PropTypes.object.isRequired
  }

  return RelateWrap
}

const routers = (app) => {
  const models = app.load_dict('models')
  const { _t } = app.context
  const names = Object.keys(models)
  const routes = {}

  for(let name of names) {
    const model = models[name]
    const modelName = model.title || model.name

    // 每个model都加上relations页面
    routes[`/app/model/${name}/`] = {
      path: ':id/relations/',
      breadcrumbName: _t('{{name}} List', { name: modelName }),
      component: ({ params: { id }, children }) => {
        return <RelateObject id={id}>{children}</RelateObject>
      }
    }

    // 循环判断每个Model的properties中的object对象
    for(let pname of Object.keys(model.properties || {})) {
      const prop = model.properties[pname]
      if(prop.type == 'object' && names.indexOf(prop.name) > -1) {
        // 找到relate对象
        const relateName = prop.name
        const relateModel = models[relateName]
        const model_routes = []

        if(!model.permission || model.permission.view) {
          model_routes.push({
            path: 'list',
            breadcrumbName: _t('{{name}} List', { name: modelName }),
            component: RelateWrap(ModelPages.ModelListPage)
          })
        }
        if(model.permission && model.permission.add) {
          model_routes.push({
            path: 'add',
            breadcrumbName: _t('Create {{name}}', { name: modelName }),
            component: RelateWrap(ModelPages.ModelFormPage)
          })
        }
        const key = `/app/model/${relateName}/:id/relations/`
        routes[key] = [ ...(routes[key] || []), {
          path: `${name}/`,
          breadcrumbName: _t('{{name}} List', { name: modelName }),
          component: Model(name, { key: `${relateName}_${name}` }),
          indexRoute: {
            onEnter: ({ location }, replace) => replace({ pathname: location.pathname + 'list' })
          },
          childRoutes: model_routes
        } ]
      }
    }
  }
  return routes
}

export default {
  name: 'xadmin.model.relate',
  mappers,
  reducers,
  form_fields,
  schema_converter,
  filter_converter
  //routers
}
