# encoding: UTF-8

require 'roda'
require 'concode'
require 'seconds'
require 'concurrent'
require 'message_bus'
require 'dotenv/load'
require 'securerandom'

GAMES = Concurrent::Map.new
MessageBus.configure(backend: :memory)

class UndeadDice < Roda
  plugin :halt
  plugin :json
  plugin :public
  plugin :message_bus
  plugin :status_handler
  plugin :typecast_params
  plugin :slash_path_empty
  plugin :render, engine: 'slim'
  plugin :sessions, secret: ENV['SESSION_SECRET']

  unless ENV['RACK_ENV'] == 'development'
    plugin :content_security_policy do |csp|
      csp.default_src :none
      csp.style_src :self
      csp.script_src :self
      csp.font_src :self
      csp.img_src :self
      csp.connect_src :self
      csp.form_action :self
      csp.base_uri :none
      csp.frame_ancestors :none
      csp.block_all_mixed_content
      csp.upgrade_insecure_requests
    end
  end
  
  use Rack::CommonLogger

  status_handler(404) do
    view :card, locals: {
      title: '¯\_(ツ)_/¯', 
      text: "Hm. Nothing here. That's weird. Oh well!"
    }
  end

  def self.new_game
    { 
      board: {}, 
      queue: [],
      active: Time.now,
      lock: Concurrent::Semaphore.new(1)
    }
  end

  route do |r|
    r.public

    r.root do 
      view :home
    end

    r.on 'new' do 
      r.get do
        if session['admin'] 
          code = Concode::Generator.new.generate SecureRandom.hex
          GAMES[code] = new_game()
          r.redirect code
        else
          view :new
        end
      end

      r.post do 
        if r.POST['password'] == ENV['PASSWORD']
          session['admin'] = true 
        end

        r.redirect
      end
    end

    r.on GAMES.keys do |code|
      r.message_bus
      game = GAMES[code]

      # this is very probably unecessary, but since two users could
      # modify the game state simultaneously, it seems prudent
      game[:lock].acquire

      r.is do
        r.get do
          render :game, locals: { 
            board: game[:board].to_json, 
            queue: game[:queue].to_json 
          }
        end
        
        r.post do
          case action = typecast_params.nonempty_str!('action')

          when 'reset'
            game[:queue].clear
            game[:board].clear
            MessageBus.publish("/#{code}", { action: 'reset' })            

          when 'pull'
            # is there no easy way to do a weighted sample in ruby?!
            color = ([:red]*3 + [:yellow]*4 + [:green]*6).sample
            game[:queue] << color

            MessageBus.publish("/#{code}", {
              action: 'pull', color: color
            })
          
          when 'roll' 
            newDice = game[:queue].map do |color|
              id = SecureRandom.hex
              game[:board][id] = { color: color }
              { id: id, color: color }
            end
            
            MessageBus.publish "/#{code}", { 
              action: 'roll', 
              dice: newDice
            }

            game[:queue].clear
            r.halt(200, newDice.map {|die| die[:id]})
          
          when 'reroll'
            id = typecast_params.nonempty_str! 'id'

            unless game[:board][id]
              r.halt 400, "no die with id #{id} in play" 
            end

            color = game[:board][id][:color]
            game[:queue] << color
            game[:board].delete(id)

            MessageBus.publish "/#{code}", { 
              action: 'remove', id: id
            }

            MessageBus.publish "/#{code}", { 
              action: 'pull', color: color
            }

          when 'diePositionReport'
            id = typecast_params.nonempty_str! 'id'
            position = typecast_params.array! :float, 'position'
            quaternion = typecast_params.array! :float, 'quaternion'
            r.halt 400 unless game[:board][id]

            game[:board][id][:position] = position
            game[:board][id][:quaternion] = quaternion

          else
            r.halt 400, "unreconized action '#{action}'"
          end

          'done'
        end
            
      ensure 
        game[:lock].release
      end
    end
  end
end

run UndeadDice.freeze.app
